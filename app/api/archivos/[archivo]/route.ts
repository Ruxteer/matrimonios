import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { CARPETA, NOMBRE_VALIDO } from "@/lib/archivos";

export const dynamic = "force-dynamic";

const TIPO_POR_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ archivo: string }> }
) {
  const { archivo } = await params;
  if (!NOMBRE_VALIDO.test(archivo)) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }
  try {
    const datos = await fs.readFile(path.join(CARPETA, archivo));
    return new Response(new Uint8Array(datos), {
      headers: {
        "Content-Type": TIPO_POR_EXT[path.extname(archivo)] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }
}
