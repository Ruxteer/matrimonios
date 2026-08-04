import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno } from "@/lib/db";
import type { Encuesta, PreguntaEncuesta } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// El evento_id no sale del servidor: el matrimonio ya viene en la dirección.
const CAMPOS =
  "id, titulo, descripcion, mensaje_final, pide_nombre, abierta, orden, created_at";

type Fila = Omit<Encuesta, "evento_id"> & { respuestas?: number };

// Listar es para todos, pero no es lo mismo: el invitado ve solo las encuestas
// abiertas y el panel las ve todas con lo que llevan respondido.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const admin = isAdmin(req);
  const conteo = admin
    ? ", (SELECT COUNT(*) FROM encuesta_respuestas r WHERE r.encuesta_id = encuestas.id) AS respuestas"
    : "";

  const encuestas = await consultar<Fila>(
    `SELECT ${CAMPOS}${conteo} FROM encuestas
      WHERE evento_id = ?${admin ? "" : " AND abierta = 1"}
      ORDER BY orden, id`,
    [evento.id]
  );
  const preguntas = await consultar<PreguntaEncuesta>(
    `SELECT p.* FROM encuesta_preguntas p
       JOIN encuestas e ON e.id = p.encuesta_id
      WHERE e.evento_id = ?${admin ? "" : " AND e.abierta = 1"}
      ORDER BY p.orden, p.id`,
    [evento.id]
  );

  return NextResponse.json(
    encuestas.map((e) => ({
      ...e,
      preguntas: preguntas.filter((p) => p.encuesta_id === e.id),
    }))
  );
}

// La encuesta nace vacía y cerrada de contenido: las preguntas se arman después
// desde el editor (PATCH), que es donde el organizador las ordena.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const titulo = String(body?.titulo ?? "").trim().slice(0, 120);
  if (!titulo) {
    return NextResponse.json({ error: "el título es requerido" }, { status: 400 });
  }
  const descripcion = String(body?.descripcion ?? "").trim().slice(0, 500);
  const mensajeFinal = String(body?.mensaje_final ?? "").trim().slice(0, 500);

  const ultima = await uno<{ siguiente: number }>(
    "SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM encuestas WHERE evento_id = ?",
    [evento.id]
  );
  const res = await ejecutar(
    `INSERT INTO encuestas (evento_id, titulo, descripcion, mensaje_final,
                            pide_nombre, abierta, orden)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      evento.id,
      titulo,
      descripcion,
      mensajeFinal,
      body?.pide_nombre ? 1 : 0,
      body?.abierta === undefined || body.abierta ? 1 : 0,
      ultima?.siguiente ?? 1,
    ]
  );
  const encuesta = await uno<Fila>(`SELECT ${CAMPOS} FROM encuestas WHERE id = ?`, [
    Number(res.lastInsertRowid),
  ]);
  return NextResponse.json({ ...encuesta, respuestas: 0, preguntas: [] }, { status: 201 });
}
