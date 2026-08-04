import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type OpcionVotacion, type Votacion } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

type OpcionConVotos = OpcionVotacion & { votos: number };

function resultadoValido(valor: unknown): valor is Votacion["resultados"] {
  return valor === "siempre" || valor === "al_cerrar" || valor === "nunca";
}

// Los conteos no viajan al teléfono del invitado hasta que corresponde
// mostrarlos: si no, se espían desde el navegador antes de tiempo.
function conteosVisibles(v: Votacion): boolean {
  return v.resultados === "siempre" || (v.resultados === "al_cerrar" && !v.abierta);
}

function sinVotos({ votos, ...opcion }: OpcionConVotos): OpcionVotacion {
  void votos;
  return opcion;
}

function armar(
  v: Votacion,
  opciones: OpcionConVotos[],
  mias: { votacion_id: number; opcion_id: number }[],
  admin: boolean
) {
  const propias = opciones.filter((o) => o.votacion_id === v.id);
  const elegidas = mias.filter((m) => m.votacion_id === v.id).map((m) => m.opcion_id);
  const mostrar = admin || conteosVisibles(v);
  return {
    ...v,
    opciones: mostrar ? propias : propias.map(sinVotos),
    total: mostrar ? propias.reduce((n, o) => n + o.votos, 0) : undefined,
    votada: elegidas.length > 0,
    elegidas,
  };
}

// El invitado ve solo las votaciones abiertas; el panel las ve todas y siempre
// con sus conteos. Con ?sesion= se le dice a cada teléfono en cuáles ya votó.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const admin = isAdmin(req);
  const sesion = (req.nextUrl.searchParams.get("sesion") ?? "").trim().slice(0, 100);

  const votaciones = await consultar<Votacion>(
    `SELECT * FROM votaciones WHERE evento_id = ?${admin ? "" : " AND abierta = 1"}
      ORDER BY orden, id`,
    [evento.id]
  );
  const opciones = await consultar<OpcionConVotos>(
    `SELECT o.*, (SELECT COUNT(*) FROM votos v WHERE v.opcion_id = o.id) AS votos
       FROM votacion_opciones o
      WHERE o.votacion_id IN (SELECT id FROM votaciones WHERE evento_id = ?)
      ORDER BY o.orden, o.id`,
    [evento.id]
  );
  const mias = sesion
    ? await consultar<{ votacion_id: number; opcion_id: number }>(
        `SELECT votacion_id, opcion_id FROM votos
          WHERE sesion = ? AND votacion_id IN (SELECT id FROM votaciones WHERE evento_id = ?)`,
        [sesion, evento.id]
      )
    : [];

  const armadas = votaciones.map((v) => armar(v, opciones, mias, admin));
  // Una votación sin alternativas todavía se está armando en el panel.
  return NextResponse.json(admin ? armadas : armadas.filter((v) => v.opciones.length));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const titulo = String(body?.titulo ?? "").trim().slice(0, 120);
  if (!titulo) {
    return NextResponse.json({ error: "el título es obligatorio" }, { status: 400 });
  }

  const ultima = await uno<{ orden: number | null }>(
    "SELECT MAX(orden) AS orden FROM votaciones WHERE evento_id = ?",
    [evento.id]
  );
  const res = await ejecutar(
    `INSERT INTO votaciones (evento_id, titulo, descripcion, multiple, resultados, abierta, orden)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      evento.id,
      titulo,
      String(body?.descripcion ?? "").trim().slice(0, 300),
      body?.multiple ? 1 : 0,
      resultadoValido(body?.resultados) ? body.resultados : "siempre",
      body?.abierta === 0 ? 0 : 1,
      Number(ultima?.orden ?? 0) + 1,
    ]
  );
  const creada = await uno<Votacion>("SELECT * FROM votaciones WHERE id = ?", [
    Number(res.lastInsertRowid),
  ]);
  return NextResponse.json({ ...creada, opciones: [], total: 0, votada: false, elegidas: [] }, {
    status: 201,
  });
}
