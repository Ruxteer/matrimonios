import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

// QR del matrimonio: apunta a la portada pública (el mismo QR sirve a todos
// los invitados). ?formato=svg para imprimirlo en cualquier tamaño.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const url = new URL(`/${evento.slug}`, req.nextUrl.origin).toString();
  const opciones = { margin: 1, color: { dark: "#58595b", light: "#ffffff" } };
  const descarga = req.nextUrl.searchParams.get("descargar") === "1";
  const nombre = `qr-${evento.slug}`;

  if (req.nextUrl.searchParams.get("formato") === "svg") {
    const svg = await QRCode.toString(url, { ...opciones, type: "svg", width: 600 });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        ...(descarga
          ? { "Content-Disposition": `attachment; filename="${nombre}.svg"` }
          : {}),
      },
    });
  }

  const png = await QRCode.toBuffer(url, { ...opciones, width: 900 });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      ...(descarga
        ? { "Content-Disposition": `attachment; filename="${nombre}.png"` }
        : {}),
    },
  });
}
