import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type PreguntaTrivia, type Trivia } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

type Partida = { trivia_id: number; participante: string; puntaje: number; total: number };

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

// El invitado juega las trivias abiertas; el panel las ve todas con cómo les
// fue. La regla del juego: lo que va al navegador antes de responder no lleva
// ni las respuestas correctas ni la explicación.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const admin = isAdmin(req);

  const trivias = await consultar<Trivia>(
    `SELECT * FROM trivias WHERE evento_id = ?${admin ? "" : " AND abierta = 1"}
      ORDER BY orden, id`,
    [evento.id]
  );
  if (!trivias.length) return NextResponse.json([]);

  const ids = trivias.map((t) => t.id);
  const marcas = ids.map(() => "?").join(", ");
  const preguntas = await consultar<PreguntaTrivia>(
    `SELECT * FROM trivia_preguntas WHERE trivia_id IN (${marcas}) ORDER BY orden, id`,
    ids
  );
  const suyas = (trivia: Trivia) => preguntas.filter((p) => p.trivia_id === trivia.id);

  if (!admin) {
    return NextResponse.json(
      trivias.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        descripcion: t.descripcion,
        preguntas: suyas(t).map((p) => ({
          id: p.id,
          enunciado: p.enunciado,
          opciones: alternativas(p.opciones),
        })),
      }))
    );
  }

  const partidas = await consultar<Partida>(
    `SELECT trivia_id, participante, puntaje, total FROM trivia_partidas
      WHERE trivia_id IN (${marcas}) ORDER BY puntaje DESC, created_at ASC`,
    ids
  );

  return NextResponse.json(
    trivias.map((t) => {
      const jugadas = partidas.filter((p) => p.trivia_id === t.id);
      return {
        ...t,
        preguntas: suyas(t).map((p) => ({
          id: p.id,
          enunciado: p.enunciado,
          opciones: alternativas(p.opciones),
          correctas: correctas(p.correctas),
          explicacion: p.explicacion,
        })),
        partidas: jugadas.length,
        promedio: jugadas.length
          ? Math.round((jugadas.reduce((s, p) => s + p.puntaje, 0) / jugadas.length) * 10) / 10
          : 0,
        ranking: jugadas.slice(0, 10).map(({ participante, puntaje, total }) => ({
          participante,
          puntaje,
          total,
        })),
      };
    })
  );
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const titulo = String(body?.titulo ?? "").trim().slice(0, 120);
  const descripcion = String(body?.descripcion ?? "").trim().slice(0, 400);
  if (!titulo) return NextResponse.json({ error: "el título es requerido" }, { status: 400 });

  const ultima = await uno<{ orden: number | null }>(
    "SELECT MAX(orden) AS orden FROM trivias WHERE evento_id = ?",
    [evento.id]
  );
  const res = await ejecutar(
    "INSERT INTO trivias (evento_id, titulo, descripcion, orden) VALUES (?, ?, ?, ?)",
    [evento.id, titulo, descripcion, Number(ultima?.orden ?? 0) + 1]
  );
  const trivia = await uno<Trivia>("SELECT * FROM trivias WHERE id = ?", [
    Number(res.lastInsertRowid),
  ]);
  return NextResponse.json(
    { ...trivia, preguntas: [], partidas: 0, promedio: 0, ranking: [] },
    { status: 201 }
  );
}
