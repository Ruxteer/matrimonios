import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, newToken, uno, Guest } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const guests = await consultar<Guest>(
    "SELECT * FROM guests WHERE evento_id = ? ORDER BY nombre COLLATE NOCASE",
    [evento.id]
  );
  return NextResponse.json(guests);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body?.nombre?.trim()) {
    return NextResponse.json({ error: "nombre es requerido" }, { status: 400 });
  }
  const result = await ejecutar(
    `INSERT INTO guests (evento_id, nombre, telefono, email, grupo, mesa, cupos, token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evento.id,
      String(body.nombre).trim(),
      String(body.telefono ?? ""),
      String(body.email ?? ""),
      String(body.grupo ?? ""),
      String(body.mesa ?? ""),
      Number(body.cupos ?? 1) || 1,
      newToken(),
    ]
  );
  const guest = await uno<Guest>("SELECT * FROM guests WHERE id = ?", [
    Number(result.lastInsertRowid),
  ]);
  return NextResponse.json(guest, { status: 201 });
}
