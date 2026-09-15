import { NextRequest, NextResponse } from "next/server";
import { db, ejecutar, uno, type Sorteo } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { leerColumnas } from "@/lib/sorteos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Sin fuente "fotos": la tabla photos no guarda quién subió cada imagen.
const FUENTES = ["invitados", "mensajes", "lista", "base"];

const entero = (v: unknown, min: number, max: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= min ? Math.min(n, max) : null;
};

// Cada campo se limpia antes de llegar al UPDATE; lo que no venga en el
// cuerpo se queda como está.
const EDITABLE: Record<string, (valor: unknown) => string | number | null> = {
  titulo: (v) => String(v ?? "").trim().slice(0, 120) || null,
  premio: (v) => String(v ?? "").trim().slice(0, 120),
  fuente: (v) => (FUENTES.includes(String(v)) ? String(v) : null),
  lista: (v) => String(v ?? "").trim().slice(0, 20000),
  cantidad: (v) => entero(v, 1, 50),
  cantidad_suplentes: (v) => entero(v, 0, 20),
  excluir_anteriores: (v) => (v ? 1 : 0),
  publicado: (v) => (v ? 1 : 0),
};

// Las columnas de la base solo pueden ser encabezados que de verdad trae el
// archivo importado (o vacías, para no usar apellido o identificador).
const COLUMNAS = ["columna_nombre", "columna_apellido", "columna_clave"] as const;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (!sorteo) return NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 });

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

  const encabezados = leerColumnas(sorteo);
  for (const campo of COLUMNAS) {
    if (!body || !(campo in body)) continue;
    const valor = String(body[campo] ?? "");
    if (valor && !encabezados.includes(valor)) continue;
    // Sin nombre no hay a quién anunciar.
    if (campo === "columna_nombre" && !valor) continue;
    sets.push(`${campo} = ?`);
    valores.push(valor);
  }

  if (!sets.length) {
    return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });
  }
  await ejecutar(`UPDATE sorteos SET ${sets.join(", ")} WHERE id = ? AND evento_id = ?`, [
    ...valores,
    sorteo.id,
    evento.id,
  ]);
  return NextResponse.json(
    await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ?", [sorteo.id])
  );
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const existe = await uno<{ id: number }>(
    "SELECT id FROM sorteos WHERE id = ? AND evento_id = ?",
    [Number(id), evento.id]
  );
  if (!existe) return NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 });

  // La base importada se va con el sorteo: puede traer datos personales.
  const c = await db();
  await c.batch(
    [
      { sql: "DELETE FROM sorteo_participantes WHERE sorteo_id = ?", args: [existe.id] },
      { sql: "DELETE FROM sorteos WHERE id = ?", args: [existe.id] },
    ],
    "write"
  );
  return NextResponse.json({ ok: true });
}
