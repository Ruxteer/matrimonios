import { NextRequest, NextResponse } from "next/server";
import { ejecutar } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { ESTADOS_MODERACION, type EstadoModeracion } from "@/lib/moderacion";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };
const idValido = (id: string) => /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;

// Aprobar o rechazar un mensaje: solo los aprobados salen en la pantalla.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  if (!idValido(id)) return NextResponse.json({ error: "mensaje no encontrado" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || !ESTADOS_MODERACION.includes(body.estado)) {
    return NextResponse.json({ error: "estado de mensaje inválido" }, { status: 400 });
  }
  const resultado = await ejecutar(
    "UPDATE messages SET estado = ? WHERE id = ? AND evento_id = ?",
    [body.estado as EstadoModeracion, Number(id), evento.id]
  );
  if (!resultado.rowsAffected) return NextResponse.json({ error: "mensaje no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, estado: body.estado });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  if (!idValido(id)) return NextResponse.json({ error: "mensaje no encontrado" }, { status: 404 });
  const resultado = await ejecutar("DELETE FROM messages WHERE id = ? AND evento_id = ?", [Number(id), evento.id]);
  if (!resultado.rowsAffected) return NextResponse.json({ error: "mensaje no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
