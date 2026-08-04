import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno } from "@/lib/db";
import type { Encuesta, PreguntaEncuesta, TipoPregunta } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const CAMPOS =
  "id, titulo, descripcion, mensaje_final, pide_nombre, abierta, orden, created_at";

const TIPOS: TipoPregunta[] = [
  "corta",
  "parrafo",
  "unica",
  "multiple",
  "escala",
  "si_no",
];

function esTipo(valor: unknown): valor is TipoPregunta {
  return TIPOS.includes(valor as TipoPregunta);
}

// Las opciones llegan como arreglo desde el editor, pero también se acepta el
// JSON tal como sale de la base para poder devolver una encuesta y reenviarla.
function leerLista(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === "string" && valor) {
    try {
      const leido = JSON.parse(valor);
      return Array.isArray(leido) ? leido : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizarOpciones(valor: unknown, tipo: TipoPregunta): string {
  if (tipo !== "unica" && tipo !== "multiple") return "";
  const opciones = leerLista(valor)
    .map((o) => String(o ?? "").trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 20);
  return opciones.length ? JSON.stringify(opciones) : "";
}

// El editor manda siempre la lista completa de preguntas: las que traen id se
// actualizan, las nuevas se insertan y las que ya no están se borran junto con
// lo que hayan contestado los invitados.
async function reemplazarPreguntas(encuestaId: number, lista: unknown[]) {
  const conservadas: number[] = [];
  let orden = 0;

  for (const item of lista) {
    const fila = (item ?? {}) as Record<string, unknown>;
    const texto = String(fila.texto ?? "").trim().slice(0, 300);
    if (!texto) continue; // una pregunta sin enunciado no se le puede mostrar a nadie
    const tipo = esTipo(fila.tipo) ? fila.tipo : "corta";
    const opciones = normalizarOpciones(fila.opciones, tipo);
    const obligatoria = fila.obligatoria ? 1 : 0;
    orden++;

    const id = Number(fila.id ?? 0);
    if (id > 0) {
      const res = await ejecutar(
        `UPDATE encuesta_preguntas
            SET texto = ?, tipo = ?, opciones = ?, obligatoria = ?, orden = ?
          WHERE id = ? AND encuesta_id = ?`,
        [texto, tipo, opciones, obligatoria, orden, id, encuestaId]
      );
      if (res.rowsAffected > 0) {
        conservadas.push(id);
        continue;
      }
    }
    const res = await ejecutar(
      `INSERT INTO encuesta_preguntas (encuesta_id, texto, tipo, opciones, obligatoria, orden)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [encuestaId, texto, tipo, opciones, obligatoria, orden]
    );
    conservadas.push(Number(res.lastInsertRowid));
  }

  const sobran = conservadas.length
    ? ` AND id NOT IN (${conservadas.map(() => "?").join(", ")})`
    : "";
  await ejecutar(
    `DELETE FROM encuesta_valores WHERE pregunta_id IN (
       SELECT id FROM encuesta_preguntas WHERE encuesta_id = ?${sobran})`,
    [encuestaId, ...conservadas]
  );
  await ejecutar(`DELETE FROM encuesta_preguntas WHERE encuesta_id = ?${sobran}`, [
    encuestaId,
    ...conservadas,
  ]);
}

async function conPreguntas(encuestaId: number) {
  const encuesta = await uno<Omit<Encuesta, "evento_id"> & { respuestas: number }>(
    `SELECT ${CAMPOS},
            (SELECT COUNT(*) FROM encuesta_respuestas r WHERE r.encuesta_id = encuestas.id)
              AS respuestas
       FROM encuestas WHERE id = ?`,
    [encuestaId]
  );
  const preguntas = await consultar<PreguntaEncuesta>(
    "SELECT * FROM encuesta_preguntas WHERE encuesta_id = ? ORDER BY orden, id",
    [encuestaId]
  );
  return { ...encuesta, preguntas };
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const encuestaId = Number(id);
  const existe = await uno<{ id: number }>(
    "SELECT id FROM encuestas WHERE id = ? AND evento_id = ?",
    [encuestaId, evento.id]
  );
  if (!existe) {
    return NextResponse.json({ error: "encuesta no encontrada" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });

  const sets: string[] = [];
  const valores: (string | number)[] = [];
  if ("titulo" in body) {
    const titulo = String(body.titulo ?? "").trim().slice(0, 120);
    if (!titulo) {
      return NextResponse.json({ error: "el título es requerido" }, { status: 400 });
    }
    sets.push("titulo = ?");
    valores.push(titulo);
  }
  for (const campo of ["descripcion", "mensaje_final"] as const) {
    if (campo in body) {
      sets.push(`${campo} = ?`);
      valores.push(String(body[campo] ?? "").trim().slice(0, 500));
    }
  }
  for (const campo of ["pide_nombre", "abierta"] as const) {
    if (campo in body) {
      sets.push(`${campo} = ?`);
      valores.push(body[campo] ? 1 : 0);
    }
  }
  if ("orden" in body) {
    sets.push("orden = ?");
    valores.push(Number(body.orden) || 0);
  }
  if (sets.length) {
    await ejecutar(`UPDATE encuestas SET ${sets.join(", ")} WHERE id = ?`, [
      ...valores,
      encuestaId,
    ]);
  }
  if (Array.isArray(body.preguntas)) {
    await reemplazarPreguntas(encuestaId, body.preguntas);
  }

  return NextResponse.json(await conPreguntas(encuestaId));
}

// Borrar la encuesta se lleva también lo que contestaron los invitados: no
// queda nada colgando de una encuesta que ya no existe.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const encuestaId = Number(id);
  const existe = await uno<{ id: number }>(
    "SELECT id FROM encuestas WHERE id = ? AND evento_id = ?",
    [encuestaId, evento.id]
  );
  if (!existe) {
    return NextResponse.json({ error: "encuesta no encontrada" }, { status: 404 });
  }

  await ejecutar(
    `DELETE FROM encuesta_valores WHERE respuesta_id IN (
       SELECT id FROM encuesta_respuestas WHERE encuesta_id = ?)`,
    [encuestaId]
  );
  await ejecutar("DELETE FROM encuesta_respuestas WHERE encuesta_id = ?", [encuestaId]);
  await ejecutar("DELETE FROM encuesta_preguntas WHERE encuesta_id = ?", [encuestaId]);
  await ejecutar("DELETE FROM encuestas WHERE id = ? AND evento_id = ?", [
    encuestaId,
    evento.id,
  ]);
  return NextResponse.json({ ok: true });
}
