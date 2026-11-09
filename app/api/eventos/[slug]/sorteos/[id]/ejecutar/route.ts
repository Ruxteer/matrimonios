import { NextRequest, NextResponse } from "next/server";
import { uno, type Sorteo } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { realizarSorteo } from "@/lib/sorteos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Ejecutar de nuevo reemplaza el resultado anterior: el sorteo guarda solo lo
// último que salió, con la hora en que se hizo y entre cuántos.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const sorteo = await uno<Sorteo>(
    "SELECT * FROM sorteos WHERE id = ? AND evento_id = ?",
    [Number(id), evento.id]
  );
  if (!sorteo) {
    return NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 });
  }

  const resultado = await realizarSorteo(sorteo, evento.id);
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  return NextResponse.json({ ...resultado.sorteo, disponibles: resultado.disponibles });
}
