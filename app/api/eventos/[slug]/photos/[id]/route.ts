import { NextRequest, NextResponse } from "next/server";
import { ejecutar, uno } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { borrarArchivo, leerImagen } from "@/lib/archivos";
import type { EstadoFoto } from "@/lib/fotos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };
const idValido = (id: string) => /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;

export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  if (!idValido(id)) return NextResponse.json({ error: "foto no encontrada" }, { status: 404 });
  const foto = await uno<{ archivo: string }>(
    "SELECT archivo FROM photos WHERE id = ? AND evento_id = ?", [Number(id), evento.id]
  );
  const imagen = foto ? await leerImagen(foto.archivo) : null;
  if (!foto || !imagen) return NextResponse.json({ error: "foto no encontrada" }, { status: 404 });
  const extension = foto.archivo.split(".").pop() || "jpg";
  return new Response(imagen.cuerpo as BodyInit, {
    headers: {
      "Content-Type": imagen.tipo,
      "Content-Disposition": `attachment; filename="${evento.slug}-foto-${id}.${extension}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  if (!idValido(id)) return NextResponse.json({ error: "foto no encontrada" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || !["pendiente", "aprobada", "rechazada"].includes(body.estado)) {
    return NextResponse.json({ error: "estado de foto inválido" }, { status: 400 });
  }
  const resultado = await ejecutar(
    "UPDATE photos SET estado = ? WHERE id = ? AND evento_id = ?",
    [body.estado as EstadoFoto, Number(id), evento.id]
  );
  if (!resultado.rowsAffected) return NextResponse.json({ error: "foto no encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true, estado: body.estado });
}

// Quitar una foto del evento: borra el registro y también la imagen guardada.
export async function DELETE(
  req: NextRequest,
  { params }: Ctx
) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  if (!idValido(id)) return NextResponse.json({ error: "foto no encontrada" }, { status: 404 });

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
