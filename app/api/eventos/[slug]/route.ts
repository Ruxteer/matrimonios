import { NextRequest, NextResponse } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";
import {
  actualizarEvento,
  eliminarEvento,
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
  if (!isAdmin(req)) return NextResponse.json(eventoPublico(evento));
  return NextResponse.json({ ...evento, resumen: await resumenEvento(evento.id) });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await actualizarEvento(evento, body));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  await eliminarEvento(evento);
  return NextResponse.json({ ok: true });
}
