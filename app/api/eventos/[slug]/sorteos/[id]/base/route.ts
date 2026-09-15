import { NextRequest, NextResponse } from "next/server";
import { uno, type Sorteo } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { borrarBase, guardarBase, leerBase, sugerirColumnas } from "@/lib/sorteos";

export const dynamic = "force-dynamic";
// Una base grande son varias decenas de miles de filas que escribir.
export const maxDuration = 60;

type Ctx = { params: Promise<{ slug: string; id: string }> };

async function cargar(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return { error: NextResponse.json({ error: "no existe" }, { status: 404 }) };
  if (!puedeAdministrar(req, evento)) return { error: noAutorizado() };
  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (!sorteo) {
    return { error: NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 }) };
  }
  return { sorteo };
}

// Sube la base de participantes (Excel o CSV) y reemplaza la anterior. Deja
// elegidas las columnas que parecen el nombre y el identificador, que después
// se pueden cambiar sin volver a subir el archivo.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { sorteo, error } = await cargar(req, ctx);
  if (error) return error;

  const form = await req.formData().catch(() => null);
  const archivo = form?.get("file");
  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }

  const lectura = await leerBase(archivo);
  if (!lectura.ok) return NextResponse.json({ error: lectura.error }, { status: 400 });

  await guardarBase(sorteo, lectura.base, archivo.name);
  return NextResponse.json(
    {
      filas: lectura.base.filas.length,
      columnas: lectura.base.columnas,
      sugeridas: sugerirColumnas(lectura.base.columnas),
    },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { sorteo, error } = await cargar(req, ctx);
  if (error) return error;
  await borrarBase(sorteo.id);
  return NextResponse.json({ ok: true });
}
