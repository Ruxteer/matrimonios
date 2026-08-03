import { NextRequest, NextResponse } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { actualizarEvento, eliminarEvento, getEvento, resumenEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!isAdmin(req)) {
    const { id, ...publico } = evento;
    void id;
    return NextResponse.json(publico);
  }
  return NextResponse.json({ ...evento, resumen: resumenEvento(evento.id) });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(actualizarEvento(evento, body));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  eliminarEvento(evento);
  return NextResponse.json({ ok: true });
}
