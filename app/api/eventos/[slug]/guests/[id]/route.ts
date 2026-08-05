import { NextRequest, NextResponse } from "next/server";
import { ejecutar, uno, Guest } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
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
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const body = await req.json();
  const fields = EDITABLE.filter((f) => f in body);
  if (fields.length === 0) {
    return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });
  }
  const sets = fields.map((f) => `${f} = ?`).join(", ");
  const valores = fields.map((f) => body[f] as string | number);
  const result = await ejecutar(
    `UPDATE guests SET ${sets}, updated_at = datetime('now')
     WHERE id = ? AND evento_id = ?`,
    [...valores, Number(id), evento.id]
  );
  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: "invitado no encontrado" }, { status: 404 });
  }
  const guest = await uno<Guest>("SELECT * FROM guests WHERE id = ?", [Number(id)]);
  return NextResponse.json(guest);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const result = await ejecutar(
    "DELETE FROM guests WHERE id = ? AND evento_id = ?",
    [Number(id), evento.id]
  );
  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: "invitado no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
