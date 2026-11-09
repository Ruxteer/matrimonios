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

const ESTADOS = ["pendiente", "confirmado", "rechazado"];

function valorValido(campo: (typeof EDITABLE)[number], valor: unknown): string | number | null {
  if (campo === "cupos" || campo === "asistentes") {
    const n = Math.trunc(Number(valor));
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 1000) : null;
  }
  if (campo === "estado") return ESTADOS.includes(String(valor)) ? String(valor) : null;
  const texto = String(valor ?? "").trim().slice(0, campo === "nota" ? 1000 : 200);
  return campo === "nombre" && !texto ? null : texto;
}

// Editar datos solo sobre la lista vigente; { restaurar: true } devuelve a la
// lista a alguien que se había eliminado.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.restaurar === true) {
    const res = await ejecutar(
      `UPDATE guests SET eliminado_at = '', updated_at = datetime('now')
        WHERE id = ? AND evento_id = ? AND eliminado_at <> ''`,
      [Number(id), evento.id]
    );
    if (res.rowsAffected === 0) {
      return NextResponse.json({ error: "participante no encontrado" }, { status: 404 });
    }
    return NextResponse.json(await uno<Guest>("SELECT * FROM guests WHERE id = ?", [Number(id)]));
  }

  const sets: string[] = [];
  const valores: (string | number)[] = [];
  for (const campo of EDITABLE) {
    if (!body || !(campo in body)) continue;
    const valor = valorValido(campo, body[campo]);
    if (valor === null) continue;
    sets.push(`${campo} = ?`);
    valores.push(valor);
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });
  }
  const result = await ejecutar(
    `UPDATE guests SET ${sets.join(", ")}, updated_at = datetime('now')
     WHERE id = ? AND evento_id = ? AND eliminado_at = ''`,
    [...valores, Number(id), evento.id]
  );
  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: "participante no encontrado" }, { status: 404 });
  }
  const guest = await uno<Guest>("SELECT * FROM guests WHERE id = ?", [Number(id)]);
  return NextResponse.json(guest);
}

// Eliminar saca a la persona de la lista pero guarda cuándo, para el historial
// de eliminados. Con ?definitivo=1, sobre alguien ya eliminado, se borra del
// todo: sus datos de contacto no tienen por qué quedarse para siempre.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const definitivo = req.nextUrl.searchParams.get("definitivo") === "1";
  const result = definitivo
    ? await ejecutar(
        "DELETE FROM guests WHERE id = ? AND evento_id = ? AND eliminado_at <> ''",
        [Number(id), evento.id]
      )
    : await ejecutar(
        `UPDATE guests SET eliminado_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND evento_id = ? AND eliminado_at = ''`,
        [Number(id), evento.id]
      );
  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: "participante no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
