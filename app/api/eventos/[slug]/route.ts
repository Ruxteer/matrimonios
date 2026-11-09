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
import { errorRegistroConfig } from "@/lib/registro";
import { clientePorId, getCliente } from "@/lib/clientes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return NextResponse.json(eventoPublico(evento));
  const maestra = isAdmin(req);
  return NextResponse.json({
    ...eventoParaPanel(evento),
    resumen: await resumenEvento(evento.id),
    // El panel esconde lo que solo puede hacer quien administra el producto.
    maestra,
    // Para volver a la lista del cliente; los organizadores no la ven.
    ...(maestra ? { cliente: await clienteResumen(evento.cliente_id) } : {}),
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const crudo = await req.json().catch(() => ({}));
  const body: Record<string, unknown> = crudo && typeof crudo === "object" && !Array.isArray(crudo) ? crudo : {};
  if ("registro_config" in body) {
    const error = errorRegistroConfig(body.registro_config);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  // Cambiar la dirección web invalida los QR ya impresos, así que eso queda
  // para quien administra el producto, no para los novios.
  if ("slug" in body && !isAdmin(req)) {
    return NextResponse.json(
      { error: "La dirección web solo la puede cambiar el administrador." },
      { status: 403 }
    );
  }

  // El cliente al que pertenece el evento es cosa del administrador. Llega
  // como slug; el id interno nunca se acepta tal cual desde afuera.
  delete body.cliente_id;
  if ("cliente" in body) {
    if (!isAdmin(req)) {
      return NextResponse.json(
        { error: "El cliente solo lo puede cambiar el administrador." },
        { status: 403 }
      );
    }
    const cliente = await getCliente(String(body.cliente ?? ""));
    if (!cliente) return NextResponse.json({ error: "Ese cliente no existe." }, { status: 400 });
    body.cliente_id = cliente.id;
    delete body.cliente;
  }

  if ("clave" in body) {
    const actualizado = await definirClaveEvento(evento, String(body.clave ?? ""));
    if (!actualizado) {
      return NextResponse.json(
        { error: "La clave debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ...actualizado, maestra: isAdmin(req) });
  }

  const actualizado = await actualizarEvento(evento, body);
  const maestra = isAdmin(req);
  return NextResponse.json({
    ...eventoParaPanel(actualizado),
    maestra,
    ...(maestra ? { cliente: await clienteResumen(actualizado.cliente_id) } : {}),
  });
}

async function clienteResumen(id: number) {
  const { slug, nombre } = await clientePorId(id);
  return { slug, nombre };
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
