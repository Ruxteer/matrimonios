import { NextRequest, NextResponse } from "next/server";
import { ejecutar, uno } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { borrarArchivo } from "@/lib/archivos";

export const dynamic = "force-dynamic";

// Quitar una foto del evento: borra el registro y también la imagen guardada.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const foto = await uno<{ archivo: string }>(
    "SELECT archivo FROM photos WHERE id = ? AND evento_id = ?",
    [Number(id), evento.id]
  );
  if (!foto) {
    return NextResponse.json({ error: "foto no encontrada" }, { status: 404 });
  }

  await ejecutar("DELETE FROM photos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  await borrarArchivo(foto.archivo);
  return NextResponse.json({ ok: true });
}
