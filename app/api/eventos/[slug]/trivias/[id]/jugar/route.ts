import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type PreguntaTrivia, type Trivia } from "@/lib/db";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

function texto(valor: unknown, max: number): string {
  return String(valor ?? "").trim().slice(0, max);
}

function indices(valor: unknown): number[] {
  const crudos = Array.isArray(valor) ? (valor as unknown[]) : [];
  return [...new Set(crudos.map(Number).filter(Number.isInteger))];
}

function correctasDe(json: string): number[] {
  try {
    return indices(JSON.parse(json || "[]"));
  } catch {
    return [];
  }
}

// Aquí se juega la partida: el puntaje se calcula en el servidor y recién con
// la respuesta se le cuenta al invitado qué era lo correcto.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const trivia = await uno<Trivia>("SELECT * FROM trivias WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (!trivia) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!trivia.abierta) {
    return NextResponse.json({ error: "la trivia está cerrada" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const participante = texto(body.participante, 60);
  const sesion = texto(body.sesion, 100);
  if (!participante) {
    return NextResponse.json({ error: "el nombre es requerido" }, { status: 400 });
  }

  const preguntas = await consultar<PreguntaTrivia>(
    "SELECT * FROM trivia_preguntas WHERE trivia_id = ? ORDER BY orden, id",
    [trivia.id]
  );
  if (!preguntas.length) {
    return NextResponse.json({ error: "la trivia no tiene preguntas" }, { status: 400 });
  }

  const elegidas = new Map<number, number[]>();
  for (const cruda of Array.isArray(body.respuestas) ? (body.respuestas as unknown[]) : []) {
    const r = (cruda ?? {}) as Record<string, unknown>;
    const preguntaId = Number(r.pregunta_id);
    if (Number.isInteger(preguntaId)) elegidas.set(preguntaId, indices(r.elegidas));
  }

  // Se acierta cuando lo marcado es exactamente el conjunto correcto: ni de
  // menos ni de más. Una pregunta sin correctas no la acierta nadie.
  const detalle = preguntas.map((p) => {
    const correctas = correctasDe(p.correctas);
    const marcadas = elegidas.get(p.id) ?? [];
    const acerto =
      correctas.length > 0 &&
      correctas.length === marcadas.length &&
      correctas.every((i) => marcadas.includes(i));
    return { pregunta_id: p.id, correctas, acerto, explicacion: p.explicacion };
  });

  const puntaje = detalle.filter((d) => d.acerto).length;
  const total = preguntas.length;
  await ejecutar(
    `INSERT INTO trivia_partidas (trivia_id, participante, puntaje, total, sesion)
     VALUES (?, ?, ?, ?, ?)`,
    [trivia.id, participante, puntaje, total, sesion]
  );

  const ranking = await consultar<{ participante: string; puntaje: number; total: number }>(
    `SELECT participante, puntaje, total FROM trivia_partidas
      WHERE trivia_id = ? ORDER BY puntaje DESC, created_at ASC LIMIT 10`,
    [trivia.id]
  );

  return NextResponse.json({ puntaje, total, detalle, ranking });
}
