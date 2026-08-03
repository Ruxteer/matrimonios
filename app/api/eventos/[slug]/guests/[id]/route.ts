import { NextRequest, NextResponse } from "next/server";
import { db, Guest } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const EDITABLE = [
  "nombre",
  "telefono",
  "email",
  "grupo",
  "mesa",
  "cupos",
  "estado",
  "asistentes",
  "nota",
] as const;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const body = await req.json();
  const fields = EDITABLE.filter((f) => f in body);
  if (fields.length === 0) {
    return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });
  }
  const sets = fields.map((f) => `${f} = @${f}`).join(", ");
  const values: Record<string, unknown> = { id: Number(id), evento: evento.id };
  for (const f of fields) values[f] = body[f];
  const result = db()
    .prepare(
      `UPDATE guests SET ${sets}, updated_at = datetime('now')
       WHERE id = @id AND evento_id = @evento`
    )
    .run(values);
  if (result.changes === 0) {
    return NextResponse.json({ error: "invitado no encontrado" }, { status: 404 });
  }
  const guest = db()
    .prepare("SELECT * FROM guests WHERE id = ?")
    .get(Number(id)) as Guest;
  return NextResponse.json(guest);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const result = db()
    .prepare("DELETE FROM guests WHERE id = ? AND evento_id = ?")
    .run(Number(id), evento.id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "invitado no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
