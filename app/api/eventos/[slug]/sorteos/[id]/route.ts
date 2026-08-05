import { NextRequest, NextResponse } from "next/server";
import { ejecutar, uno, type Sorteo } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Sin fuente "fotos": la tabla photos no guarda quién subió cada imagen.
const FUENTES = ["invitados", "mensajes", "lista"];

// Cada campo se limpia antes de llegar al UPDATE; lo que no venga en el
// cuerpo se queda como está.
const EDITABLE: Record<string, (valor: unknown) => string | number | null> = {
  titulo: (v) => String(v ?? "").trim().slice(0, 120) || null,
  premio: (v) => String(v ?? "").trim().slice(0, 120),
  fuente: (v) => (FUENTES.includes(String(v)) ? String(v) : null),
  lista: (v) => String(v ?? "").trim().slice(0, 20000),
  cantidad: (v) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : null;
  },
  excluir_anteriores: (v) => (v ? 1 : 0),
  publicado: (v) => (v ? 1 : 0),
};

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const body = await req.json().catch(() => null);
  const sets: string[] = [];
  const valores: (string | number)[] = [];
  for (const [campo, limpiar] of Object.entries(EDITABLE)) {
    if (!body || !(campo in body)) continue;
    const valor = limpiar(body[campo]);
    if (valor === null) continue;
    sets.push(`${campo} = ?`);
    valores.push(valor);
  }
  if (!sets.length) {
    return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });
  }

  const res = await ejecutar(
    `UPDATE sorteos SET ${sets.join(", ")} WHERE id = ? AND evento_id = ?`,
    [...valores, Number(id), evento.id]
  );
  if (res.rowsAffected === 0) {
    return NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 });
  }
  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ?", [Number(id)]);
  return NextResponse.json(sorteo);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const res = await ejecutar("DELETE FROM sorteos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (res.rowsAffected === 0) {
    return NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
