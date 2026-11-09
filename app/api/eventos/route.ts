import { NextRequest, NextResponse } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getCliente } from "@/lib/clientes";
import {
  crearEvento,
  eventoParaPanel,
  eventosDeCliente,
  listarEventos,
  resumenEvento,
} from "@/lib/eventos";

export const dynamic = "force-dynamic";

// ?cliente=<slug> deja solo los eventos de ese cliente (venito = los propios).
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return noAutorizado();
  const filtro = req.nextUrl.searchParams.get("cliente");
  let eventos;
  if (filtro) {
    const cliente = await getCliente(filtro);
    if (!cliente) return NextResponse.json({ error: "no existe" }, { status: 404 });
    eventos = await eventosDeCliente(cliente.id);
  } else {
    eventos = await listarEventos();
  }
  const conResumen = await Promise.all(
    eventos.map(async (e) => ({
      ...eventoParaPanel(e),
      resumen: await resumenEvento(e.id),
    }))
  );
  return NextResponse.json(conResumen);
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return noAutorizado();
  const body = await req.json().catch(() => null);
  const tipo = body?.tipo === "activacion" ? "activacion" : "matrimonio";
  const titulo = String(body?.titulo ?? "").trim().slice(0, 200);
  const nombre1 = String(body?.nombre1 ?? (tipo === "activacion" ? titulo : "")).trim().slice(0, 120);
  const nombre2 = String(body?.nombre2 ?? "").trim().slice(0, 120);
  if (tipo === "activacion" ? !titulo : !nombre1 || !nombre2) {
    return NextResponse.json(
      { error: tipo === "activacion" ? "El nombre del evento es requerido." : "Faltan los nombres de los novios." },
      { status: 400 }
    );
  }
  // El evento nace dentro del cliente desde cuya página se creó.
  let clienteId = 0;
  if (body?.cliente) {
    const cliente = await getCliente(String(body.cliente));
    if (!cliente) return NextResponse.json({ error: "Ese cliente no existe." }, { status: 400 });
    clienteId = cliente.id;
  }
  const evento = await crearEvento({
    nombre1,
    nombre2,
    tipo,
    titulo,
    descripcion: String(body?.descripcion ?? ""),
    fecha: String(body?.fecha ?? ""),
    slug: String(body?.slug ?? ""),
    clienteId,
  });
  return NextResponse.json(eventoParaPanel(evento), { status: 201 });
}
