import { NextResponse } from "next/server";
import { leerImagen } from "@/lib/archivos";

export const dynamic = "force-dynamic";

// Única puerta de entrada a las imágenes: en la nube están en un almacén
// privado, así que se entregan desde aquí y nunca por una URL pública.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ archivo: string }> }
) {
  const { archivo } = await params;
  const imagen = await leerImagen(archivo);
  if (!imagen) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }
  return new Response(imagen.cuerpo as BodyInit, {
    headers: {
      "Content-Type": imagen.tipo,
      "X-Content-Type-Options": "nosniff",
      // El nombre es aleatorio y nunca se reutiliza, así que la copia del
      // navegador siempre sigue siendo válida.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
