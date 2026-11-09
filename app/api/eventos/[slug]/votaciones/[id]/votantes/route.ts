import { NextRequest, NextResponse } from "next/server";
import { consultar, uno, type Votacion } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { respuestaCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Quiénes votaron en una votación con registro: nombre, correo, qué eligieron
// y cuándo. Solo para el panel.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const votacion = await uno<Votacion>(
    "SELECT * FROM votaciones WHERE id = ? AND evento_id = ?",
    [Number(id), evento.id]
  );
  if (!votacion) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const filas = await consultar<{ nombre: string; email: string; elegidas: string; fecha: string }>(
    `SELECT v.nombre, v.email, GROUP_CONCAT(o.texto, ' / ') AS elegidas, MIN(v.created_at) AS fecha
       FROM votos v JOIN votacion_opciones o ON o.id = v.opcion_id
      WHERE v.votacion_id = ? AND v.email <> ''
      GROUP BY v.email ORDER BY fecha`,
    [votacion.id]
  );
  return respuestaCsv(
    [
      ["Nombre", "Correo", "Eligió", "Fecha (UTC)"],
      ...filas.map((f) => [f.nombre, f.email, f.elegidas, f.fecha]),
    ],
    `votantes-${evento.slug}-${votacion.id}.csv`
  );
}
