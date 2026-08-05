import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno } from "@/lib/db";
import type { PreguntaEncuesta } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

function opcionesDe(pregunta: PreguntaEncuesta): string[] {
  try {
    const leido = JSON.parse(pregunta.opciones || "[]");
    return Array.isArray(leido) ? leido.map((o) => String(o)) : [];
  } catch {
    return [];
  }
}

// Cada tipo de pregunta guarda un texto distinto y aquí se decide cuál: lo que
// no calza con la pregunta se descarta en vez de ensuciar los resultados.
function normalizarValor(pregunta: PreguntaEncuesta, valor: unknown): string {
  const opciones = opcionesDe(pregunta);
  switch (pregunta.tipo) {
    case "multiple": {
      const crudas = Array.isArray(valor) ? valor : [valor];
      const elegidas = crudas
        .map((o) => String(o ?? "").trim())
        .filter((o) => o && (!opciones.length || opciones.includes(o)));
      return elegidas.length ? JSON.stringify([...new Set(elegidas)]) : "";
    }
    case "unica": {
      const elegida = String(valor ?? "").trim();
      return !opciones.length || opciones.includes(elegida) ? elegida : "";
    }
    case "escala": {
      const nota = Number(valor);
      return Number.isInteger(nota) && nota >= 1 && nota <= 5 ? String(nota) : "";
    }
    case "si_no": {
      const dicho = String(valor ?? "").trim().toLowerCase();
      if (dicho === "si" || dicho === "sí") return "si";
      return dicho === "no" ? "no" : "";
    }
    case "parrafo":
      return String(valor ?? "").trim().slice(0, 1000);
    default:
      return String(valor ?? "").trim().slice(0, 300);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const encuestaId = Number(id);
  const encuesta = await uno<{ abierta: number }>(
    "SELECT abierta FROM encuestas WHERE id = ? AND evento_id = ?",
    [encuestaId, evento.id]
  );
  if (!encuesta) {
    return NextResponse.json({ error: "encuesta no encontrada" }, { status: 404 });
  }
  if (!encuesta.abierta) {
    return NextResponse.json({ error: "la encuesta está cerrada" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const participante = String(body?.participante ?? "").trim().slice(0, 80);
  const sesion = String(body?.sesion ?? "").trim().slice(0, 100);

  // Sin sesión (navegación privada) no hay forma de reconocer al invitado, así
  // que se le deja responder igual antes que dejarlo fuera.
  if (sesion) {
    const previa = await uno<{ id: number }>(
      "SELECT id FROM encuesta_respuestas WHERE encuesta_id = ? AND sesion = ?",
      [encuestaId, sesion]
    );
    if (previa) {
      return NextResponse.json({ error: "ya respondiste" }, { status: 409 });
    }
  }

  const preguntas = await consultar<PreguntaEncuesta>(
    "SELECT * FROM encuesta_preguntas WHERE encuesta_id = ? ORDER BY orden, id",
    [encuestaId]
  );
  const porId = new Map(preguntas.map((p) => [p.id, p]));
  const respondido = new Map<number, string>();
  for (const item of Array.isArray(body?.valores) ? body.valores : []) {
    const preguntaId = Number((item as { pregunta_id?: unknown })?.pregunta_id ?? 0);
    const pregunta = porId.get(preguntaId);
    if (!pregunta) continue; // pregunta de otra encuesta o ya borrada
    const valor = normalizarValor(pregunta, (item as { valor?: unknown }).valor);
    if (valor) respondido.set(pregunta.id, valor);
  }

  const falta = preguntas.find((p) => p.obligatoria === 1 && !respondido.has(p.id));
  if (falta) {
    return NextResponse.json(
      { error: `falta responder: ${falta.texto}` },
      { status: 400 }
    );
  }

  const res = await ejecutar(
    "INSERT INTO encuesta_respuestas (encuesta_id, participante, sesion) VALUES (?, ?, ?)",
    [encuestaId, participante, sesion]
  );
  const respuestaId = Number(res.lastInsertRowid);
  for (const [preguntaId, valor] of respondido) {
    await ejecutar(
      "INSERT INTO encuesta_valores (respuesta_id, pregunta_id, valor) VALUES (?, ?, ?)",
      [respuestaId, preguntaId, valor]
    );
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

// Las respuestas completas son del panel: es con lo que arma los resultados.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const encuestaId = Number(id);
  const existe = await uno<{ id: number }>(
    "SELECT id FROM encuestas WHERE id = ? AND evento_id = ?",
    [encuestaId, evento.id]
  );
  if (!existe) {
    return NextResponse.json({ error: "encuesta no encontrada" }, { status: 404 });
  }

  const respuestas = await consultar<{
    id: number;
    participante: string;
    created_at: string;
  }>(
    `SELECT id, participante, created_at FROM encuesta_respuestas
      WHERE encuesta_id = ? ORDER BY created_at DESC, id DESC`,
    [encuestaId]
  );
  const valores = await consultar<{
    respuesta_id: number;
    pregunta_id: number;
    valor: string;
  }>(
    `SELECT v.respuesta_id, v.pregunta_id, v.valor FROM encuesta_valores v
       JOIN encuesta_respuestas r ON r.id = v.respuesta_id
      WHERE r.encuesta_id = ?`,
    [encuestaId]
  );

  return NextResponse.json(
    respuestas.map((r) => ({
      ...r,
      valores: valores
        .filter((v) => v.respuesta_id === r.id)
        .map(({ pregunta_id, valor }) => ({ pregunta_id, valor })),
    }))
  );
}
