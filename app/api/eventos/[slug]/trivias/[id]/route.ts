import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type PreguntaTrivia, type Trivia } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

type Partida = { participante: string; puntaje: number; total: number };

function texto(valor: unknown, max: number): string {
  return String(valor ?? "").trim().slice(0, max);
}

function alternativas(json: string): string[] {
  try {
    const valor = JSON.parse(json || "[]");
    return Array.isArray(valor) ? valor.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function correctas(json: string): number[] {
  try {
    const valor = JSON.parse(json || "[]");
    return Array.isArray(valor) ? valor.map(Number).filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

// Ninguna trivia se toca por id a secas: tiene que ser del matrimonio del slug.
async function buscar(slug: string, id: string): Promise<Trivia | null> {
  const evento = await getEvento(slug);
  if (!evento) return null;
  return uno<Trivia>("SELECT * FROM trivias WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
}

// El panel siempre recibe la trivia completa: preguntas, cuánto se jugó y cómo
// les fue, que es lo mismo que devuelve el listado.
async function paraElPanel(trivia: Trivia) {
  const preguntas = await consultar<PreguntaTrivia>(
    "SELECT * FROM trivia_preguntas WHERE trivia_id = ? ORDER BY orden, id",
    [trivia.id]
  );
  const partidas = await consultar<Partida>(
    `SELECT participante, puntaje, total FROM trivia_partidas
      WHERE trivia_id = ? ORDER BY puntaje DESC, created_at ASC`,
    [trivia.id]
  );
  return {
    ...trivia,
    preguntas: preguntas.map((p) => ({
      id: p.id,
      enunciado: p.enunciado,
      opciones: alternativas(p.opciones),
      correctas: correctas(p.correctas),
      explicacion: p.explicacion,
    })),
    partidas: partidas.length,
    promedio: partidas.length
      ? Math.round((partidas.reduce((s, p) => s + p.puntaje, 0) / partidas.length) * 10) / 10
      : 0,
    ranking: partidas.slice(0, 10),
  };
}

// Las preguntas llegan como la lista completa y en el orden en que quedaron:
// las que traen id se actualizan, las nuevas se crean y las que ya no vienen
// se borran.
async function guardarPreguntas(trivia: Trivia, crudas: unknown[]) {
  const existentes = await consultar<{ id: number }>(
    "SELECT id FROM trivia_preguntas WHERE trivia_id = ?",
    [trivia.id]
  );
  const vivas = new Set<number>();
  let orden = 0;

  for (const cruda of crudas) {
    const p = (cruda ?? {}) as Record<string, unknown>;
    const enunciado = texto(p.enunciado, 300);
    const opciones = (Array.isArray(p.opciones) ? (p.opciones as unknown[]) : [])
      .map((o) => texto(o, 160))
      .filter(Boolean)
      .slice(0, 8);
    // Una pregunta sin enunciado o con una sola alternativa no se puede jugar.
    if (!enunciado || opciones.length < 2) continue;

    const marcadas = [
      ...new Set(
        (Array.isArray(p.correctas) ? (p.correctas as unknown[]) : [])
          .map(Number)
          .filter((i) => Number.isInteger(i) && i >= 0 && i < opciones.length)
      ),
    ].sort((a, b) => a - b);
    const explicacion = texto(p.explicacion, 300);
    const id = Number(p.id);
    const datos = [
      enunciado,
      JSON.stringify(opciones),
      JSON.stringify(marcadas),
      explicacion,
      orden++,
    ];

    if (existentes.some((e) => e.id === id)) {
      vivas.add(id);
      await ejecutar(
        `UPDATE trivia_preguntas
            SET enunciado = ?, opciones = ?, correctas = ?, explicacion = ?, orden = ?
          WHERE id = ? AND trivia_id = ?`,
        [...datos, id, trivia.id]
      );
    } else {
      await ejecutar(
        `INSERT INTO trivia_preguntas
           (trivia_id, enunciado, opciones, correctas, explicacion, orden)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [trivia.id, ...datos]
      );
    }
  }

  for (const e of existentes) {
    if (!vivas.has(e.id)) {
      await ejecutar("DELETE FROM trivia_preguntas WHERE id = ?", [e.id]);
    }
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const trivia = await buscar(slug, id);
  if (!trivia) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const valores: (string | number)[] = [];

  if ("titulo" in body) {
    const titulo = texto(body.titulo, 120);
    if (!titulo) {
      return NextResponse.json({ error: "el título es requerido" }, { status: 400 });
    }
    sets.push("titulo = ?");
    valores.push(titulo);
  }
  if ("descripcion" in body) {
    sets.push("descripcion = ?");
    valores.push(texto(body.descripcion, 400));
  }
  if ("abierta" in body) {
    sets.push("abierta = ?");
    valores.push(body.abierta ? 1 : 0);
  }
  if ("orden" in body) {
    sets.push("orden = ?");
    valores.push(Number(body.orden) || 0);
  }
  if (sets.length) {
    await ejecutar(`UPDATE trivias SET ${sets.join(", ")} WHERE id = ?`, [
      ...valores,
      trivia.id,
    ]);
  }
  if (Array.isArray(body.preguntas)) {
    await guardarPreguntas(trivia, body.preguntas as unknown[]);
  }

  const actualizada = (await uno<Trivia>("SELECT * FROM trivias WHERE id = ?", [trivia.id]))!;
  return NextResponse.json(await paraElPanel(actualizada));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const trivia = await buscar(slug, id);
  if (!trivia) return NextResponse.json({ error: "no existe" }, { status: 404 });

  await ejecutar("DELETE FROM trivia_preguntas WHERE trivia_id = ?", [trivia.id]);
  await ejecutar("DELETE FROM trivia_partidas WHERE trivia_id = ?", [trivia.id]);
  await ejecutar("DELETE FROM trivias WHERE id = ?", [trivia.id]);
  return NextResponse.json({ ok: true });
}
