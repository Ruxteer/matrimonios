import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type OpcionVotacion, type Votacion } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

async function buscar(slug: string, id: string): Promise<Votacion | null> {
  const evento = await getEvento(slug);
  if (!evento) return null;
  return uno<Votacion>("SELECT * FROM votaciones WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
}

function sinVotos({ votos, ...opcion }: OpcionVotacion & { votos: number }): OpcionVotacion {
  void votos;
  return opcion;
}

// El invitado recibe los conteos recién votados solo si esta votación los
// muestra; si no, se queda con el agradecimiento.
async function conResultados(votacion: Votacion, elegidas: number[]) {
  const opciones = await consultar<OpcionVotacion & { votos: number }>(
    `SELECT o.*, (SELECT COUNT(*) FROM votos v WHERE v.opcion_id = o.id) AS votos
       FROM votacion_opciones o WHERE o.votacion_id = ? ORDER BY o.orden, o.id`,
    [votacion.id]
  );
  const mostrar =
    votacion.resultados === "siempre" ||
    (votacion.resultados === "al_cerrar" && !votacion.abierta);
  return {
    ...votacion,
    opciones: mostrar ? opciones : opciones.map(sinVotos),
    total: mostrar ? opciones.reduce((n, o) => n + o.votos, 0) : undefined,
    votada: true,
    elegidas,
  };
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const votacion = await buscar(slug, id);
  if (!votacion) return NextResponse.json({ error: "no existe" }, { status: 404 });
  // 403 y no 409: el 409 queda reservado para "este teléfono ya votó".
  if (!votacion.abierta) {
    return NextResponse.json({ error: "la votación está cerrada" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const sesion = String(body?.sesion ?? "").trim().slice(0, 100);
  const pedidas: unknown[] = Array.isArray(body?.opciones) ? body.opciones : [];
  const elegidas = [...new Set(pedidas.map(Number).filter(Number.isInteger))];

  if (!elegidas.length) {
    return NextResponse.json({ error: "elige una alternativa" }, { status: 400 });
  }
  if (!votacion.multiple && elegidas.length > 1) {
    return NextResponse.json({ error: "solo puedes elegir una" }, { status: 400 });
  }
  const suyas = await consultar<{ id: number }>(
    "SELECT id FROM votacion_opciones WHERE votacion_id = ?",
    [votacion.id]
  );
  const validas = new Set(suyas.map((o) => o.id));
  if (elegidas.some((opcion) => !validas.has(opcion))) {
    return NextResponse.json({ error: "alternativa inválida" }, { status: 400 });
  }

  // Sin sesión (navegación privada) no hay forma de reconocer el teléfono: se
  // deja votar igual antes que dejar a alguien afuera.
  if (sesion) {
    const ya = await uno<{ id: number }>(
      "SELECT id FROM votos WHERE votacion_id = ? AND sesion = ? LIMIT 1",
      [votacion.id, sesion]
    );
    if (ya) {
      return NextResponse.json({ error: "ya votaste en esta votación" }, { status: 409 });
    }
  }

  for (const opcion of elegidas) {
    await ejecutar(
      "INSERT INTO votos (votacion_id, opcion_id, sesion) VALUES (?, ?, ?)",
      [votacion.id, opcion, sesion]
    );
  }
  return NextResponse.json(await conResultados(votacion, elegidas), { status: 201 });
}

// Reiniciar los votos: deja la votación lista para usarla de nuevo sin tener
// que rehacer las alternativas.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const votacion = await buscar(slug, id);
  if (!votacion) return NextResponse.json({ error: "no existe" }, { status: 404 });

  await ejecutar("DELETE FROM votos WHERE votacion_id = ?", [votacion.id]);
  return NextResponse.json({ ok: true });
}
