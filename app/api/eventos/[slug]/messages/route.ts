import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// Leer todos los mensajes es del panel; dejarlos (POST) es de los invitados.
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const messages = db()
    .prepare("SELECT * FROM messages WHERE evento_id = ? ORDER BY created_at DESC")
    .all(evento.id);
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim();
  const mensaje = String(body?.mensaje ?? "").trim().slice(0, 300);
  if (!nombre || !mensaje) {
    return NextResponse.json(
      { error: "nombre y mensaje son requeridos" },
      { status: 400 }
    );
  }
  db()
    .prepare("INSERT INTO messages (evento_id, nombre, mensaje) VALUES (?, ?, ?)")
    .run(evento.id, nombre, mensaje);
  return NextResponse.json({ ok: true }, { status: 201 });
}
