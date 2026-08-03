import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { guardarImagen } from "@/lib/archivos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// Ver la galería completa es del panel; subir es de los invitados.
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const photos = db()
    .prepare("SELECT * FROM photos WHERE evento_id = ? ORDER BY created_at DESC")
    .all(evento.id);
  return NextResponse.json(photos);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const form = await req.formData();
  const guardado = await guardarImagen(form.get("file"));
  if (!guardado.ok) {
    return NextResponse.json({ error: guardado.error }, { status: 400 });
  }
  db()
    .prepare("INSERT INTO photos (evento_id, archivo) VALUES (?, ?)")
    .run(evento.id, guardado.archivo);
  return NextResponse.json({ ok: true, archivo: guardado.archivo }, { status: 201 });
}
