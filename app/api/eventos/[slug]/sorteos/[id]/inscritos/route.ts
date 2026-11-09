import { NextRequest, NextResponse } from "next/server";
import { consultar, uno } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { respuestaCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Quienes se inscribieron con el QR, para contactarlos después. Solo el panel.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const sorteo = await uno<{ id: number }>("SELECT id FROM sorteos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (!sorteo) return NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 });

  const filas = await consultar<{ nombre: string; email: string; created_at: string }>(
    "SELECT nombre, email, created_at FROM sorteo_inscritos WHERE sorteo_id = ? ORDER BY id",
    [sorteo.id]
  );
  return respuestaCsv(
    [["Nombre", "Correo", "Inscrito (UTC)"], ...filas.map((f) => [f.nombre, f.email, f.created_at])],
    `inscritos-${evento.slug}-${sorteo.id}.csv`
  );
}
