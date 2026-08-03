import { NextRequest, NextResponse } from "next/server";
import { db, newToken, Guest } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const guests = db()
    .prepare("SELECT * FROM guests WHERE evento_id = ? ORDER BY nombre COLLATE NOCASE")
    .all(evento.id) as Guest[];
  return NextResponse.json(guests);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body?.nombre?.trim()) {
    return NextResponse.json({ error: "nombre es requerido" }, { status: 400 });
  }
  const result = db()
    .prepare(
      `INSERT INTO guests (evento_id, nombre, telefono, email, grupo, mesa, cupos, token)
       VALUES (@evento_id, @nombre, @telefono, @email, @grupo, @mesa, @cupos, @token)`
    )
    .run({
      evento_id: evento.id,
      nombre: String(body.nombre).trim(),
      telefono: String(body.telefono ?? ""),
      email: String(body.email ?? ""),
      grupo: String(body.grupo ?? ""),
      mesa: String(body.mesa ?? ""),
      cupos: Number(body.cupos ?? 1) || 1,
      token: newToken(),
    });
  const guest = db()
    .prepare("SELECT * FROM guests WHERE id = ?")
    .get(result.lastInsertRowid);
  return NextResponse.json(guest, { status: 201 });
}
