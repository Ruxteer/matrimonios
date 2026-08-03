import { NextRequest, NextResponse } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { guardarImagen } from "@/lib/archivos";

export const dynamic = "force-dynamic";

// Sube una imagen del panel (banner o plano) y devuelve su nombre de archivo.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return noAutorizado();
  const form = await req.formData();
  const guardado = await guardarImagen(form.get("file"));
  if (!guardado.ok) {
    return NextResponse.json({ error: guardado.error }, { status: 400 });
  }
  return NextResponse.json({ archivo: guardado.archivo }, { status: 201 });
}
