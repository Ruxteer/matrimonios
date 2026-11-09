import { NextRequest, NextResponse } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { crearCliente, eventosPorCliente, listarClientes } from "@/lib/clientes";

export const dynamic = "force-dynamic";

// Los clientes son del administrador del producto: los novios y organizadores
// con clave propia solo ven su evento.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return noAutorizado();
  const [clientes, conteo] = await Promise.all([listarClientes(), eventosPorCliente()]);
  return NextResponse.json(clientes.map((c) => ({ ...c, eventos: conteo.get(c.id) ?? 0 })));
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return noAutorizado();
  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ error: "El nombre del cliente es requerido." }, { status: 400 });
  }
  const cliente = await crearCliente({ nombre, color: body?.color, logo: body?.logo });
  return NextResponse.json(cliente, { status: 201 });
}
