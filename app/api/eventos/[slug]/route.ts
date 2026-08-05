import { NextRequest, NextResponse } from "next/server";
import { isAdmin, noAutorizado, puedeAdministrar } from "@/lib/auth";
import {
  actualizarEvento,
  definirClaveEvento,
  eliminarEvento,
  eventoParaPanel,
  eventoPublico,
  getEvento,
  resumenEvento,
} from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return NextResponse.json(eventoPublico(evento));
  return NextResponse.json({
    ...eventoParaPanel(evento),
    resumen: await resumenEvento(evento.id),
    // El panel esconde lo que solo puede hacer quien administra el producto.
    maestra: isAdmin(req),
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const body = await req.json().catch(() => ({}));

  // Cambiar la dirección web invalida los QR ya impresos, así que eso queda
  // para quien administra el producto, no para los novios.
  if ("slug" in body && !isAdmin(req)) {
    return NextResponse.json(
      { error: "La dirección web solo la puede cambiar el administrador." },
      { status: 403 }
    );
  }

  if ("clave" in body) {
    const actualizado = await definirClaveEvento(evento, String(body.clave ?? ""));
    if (!actualizado) {
      return NextResponse.json(
        { error: "La clave debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }
    return NextResponse.json(actualizado);
  }

  return NextResponse.json(eventoParaPanel(await actualizarEvento(evento, body)));
}

// Eliminar un matrimonio es solo de la clave maestra: los novios no pueden
// borrarse a sí mismos junto con su lista de invitados.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  await eliminarEvento(evento);
  return NextResponse.json({ ok: true });
}
