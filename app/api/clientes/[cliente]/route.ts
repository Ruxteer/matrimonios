import { NextRequest, NextResponse } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { actualizarCliente, eliminarCliente, getCliente, VENITO } from "@/lib/clientes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ cliente: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const cliente = await getCliente((await params).cliente);
  if (!cliente) return NextResponse.json({ error: "no existe" }, { status: 404 });
  return NextResponse.json(cliente);
}

// Venito no se edita ni se borra: es el producto, no un cliente más.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const cliente = await getCliente((await params).cliente);
  if (!cliente) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (cliente.id === VENITO.id) {
    return NextResponse.json({ error: "Venito no se puede editar." }, { status: 400 });
  }
  const crudo = await req.json().catch(() => ({}));
  const body = crudo && typeof crudo === "object" && !Array.isArray(crudo) ? crudo : {};
  return NextResponse.json(await actualizarCliente(cliente, body));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const cliente = await getCliente((await params).cliente);
  if (!cliente) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (cliente.id === VENITO.id) {
    return NextResponse.json({ error: "Venito no se puede eliminar." }, { status: 400 });
  }
  await eliminarCliente(cliente);
  return NextResponse.json({ ok: true });
}
