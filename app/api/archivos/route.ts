import { NextRequest, NextResponse } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { eventoDeSesion } from "@/lib/eventos";
import { guardarImagen } from "@/lib/archivos";

export const dynamic = "force-dynamic";

// Sube una imagen del panel (banner o plano) y devuelve su nombre de archivo.
export async function POST(req: NextRequest) {
  // Vale la clave maestra o la de cualquier matrimonio: sus novios también
  // suben imágenes y bajan la planilla.
  if (!isAdmin(req) && !(await eventoDeSesion(req))) return noAutorizado();
  const form = await req.formData();
  const guardado = await guardarImagen(form.get("file"));
  if (!guardado.ok) {
    return NextResponse.json({ error: guardado.error }, { status: 400 });
  }
  return NextResponse.json({ archivo: guardado.archivo }, { status: 201 });
}
