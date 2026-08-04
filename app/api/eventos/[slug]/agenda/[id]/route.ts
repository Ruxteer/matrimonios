import { NextRequest, NextResponse } from "next/server";
import { ejecutar, uno, type Actividad } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const LARGOS: Record<string, number> = {
  titulo: 120,
  descripcion: 500,
  lugar: 120,
  hora: 20,
  dia: 60,
};

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  // La actividad tiene que ser de este matrimonio: el id por sí solo no basta.
  const actividad = await uno<Actividad>(
    "SELECT * FROM agenda WHERE id = ? AND evento_id = ?",
    [Number(id), evento.id]
  );
  if (!actividad) {
    return NextResponse.json({ error: "actividad no encontrada" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const sets: string[] = [];
  const valores: (string | number)[] = [];
  for (const [campo, largo] of Object.entries(LARGOS)) {
    if (!body || !(campo in body)) continue;
    const valor = String(body[campo] ?? "").trim().slice(0, largo);
    if (campo === "titulo" && !valor) {
      return NextResponse.json(
        { error: "El título no puede quedar vacío." },
        { status: 400 }
      );
    }
    sets.push(`${campo} = ?`);
    valores.push(valor);
  }
  if (body && "orden" in body) {
    sets.push("orden = ?");
    valores.push(Math.trunc(Number(body.orden)) || 0);
  }
  if (!sets.length) {
    return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });
  }

  await ejecutar(`UPDATE agenda SET ${sets.join(", ")} WHERE id = ? AND evento_id = ?`, [
    ...valores,
    actividad.id,
    evento.id,
  ]);
  const actualizada = await uno<Actividad>("SELECT * FROM agenda WHERE id = ?", [
    actividad.id,
  ]);
  return NextResponse.json(actualizada);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const resultado = await ejecutar("DELETE FROM agenda WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (resultado.rowsAffected === 0) {
    return NextResponse.json({ error: "actividad no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
