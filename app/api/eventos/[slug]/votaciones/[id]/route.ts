import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type OpcionVotacion, type Votacion } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { borrarArchivo } from "@/lib/archivos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

function resultadoValido(valor: unknown): valor is Votacion["resultados"] {
  return valor === "siempre" || valor === "al_cerrar" || valor === "nunca";
}

// Solo lo usa el panel, así que los conteos van siempre.
async function conDetalle(votacion: Votacion) {
  const opciones = await consultar<OpcionVotacion & { votos: number }>(
    `SELECT o.*, (SELECT COUNT(*) FROM votos v WHERE v.opcion_id = o.id) AS votos
       FROM votacion_opciones o WHERE o.votacion_id = ? ORDER BY o.orden, o.id`,
    [votacion.id]
  );
  return {
    ...votacion,
    opciones,
    total: opciones.reduce((n, o) => n + o.votos, 0),
    votada: false,
    elegidas: [] as number[],
  };
}

// El panel manda la lista completa de alternativas: las que traen id se
// actualizan, las nuevas se crean y las que ya no vienen se borran con sus
// votos. Así el orden que se ve en pantalla es el que queda guardado.
async function sincronizarOpciones(votacion: Votacion, entrantes: unknown[]) {
  const actuales = await consultar<{ id: number; imagen: string }>(
    "SELECT id, imagen FROM votacion_opciones WHERE votacion_id = ?",
    [votacion.id]
  );
  const vivas = new Set<number>();
  let orden = 0;

  for (const item of entrantes) {
    const fila = item as { id?: unknown; texto?: unknown; imagen?: unknown };
    const texto = String(fila?.texto ?? "").trim().slice(0, 120);
    if (!texto) continue; // una alternativa sin nombre no se guarda
    const imagen = String(fila?.imagen ?? "").trim().slice(0, 300);
    const anterior = actuales.find((a) => a.id === Number(fila?.id));

    if (anterior) {
      await ejecutar(
        `UPDATE votacion_opciones SET texto = ?, imagen = ?, orden = ?
          WHERE id = ? AND votacion_id = ?`,
        [texto, imagen, orden, anterior.id, votacion.id]
      );
      vivas.add(anterior.id);
      if (anterior.imagen && anterior.imagen !== imagen) await borrarArchivo(anterior.imagen);
    } else {
      await ejecutar(
        "INSERT INTO votacion_opciones (votacion_id, texto, imagen, orden) VALUES (?, ?, ?, ?)",
        [votacion.id, texto, imagen, orden]
      );
    }
    orden++;
  }

  for (const a of actuales) {
    if (vivas.has(a.id)) continue;
    await ejecutar("DELETE FROM votos WHERE opcion_id = ?", [a.id]);
    await ejecutar("DELETE FROM votacion_opciones WHERE id = ?", [a.id]);
    await borrarArchivo(a.imagen);
  }
}

async function buscar(slug: string, id: string): Promise<Votacion | null> {
  const evento = await getEvento(slug);
  if (!evento) return null;
  // La votación tiene que ser de este matrimonio: el id solo no alcanza.
  return uno<Votacion>("SELECT * FROM votaciones WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const votacion = await buscar(slug, id);
  if (!votacion) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });

  const sets: string[] = [];
  const valores: (string | number)[] = [];
  if ("titulo" in body) {
    const titulo = String(body.titulo ?? "").trim().slice(0, 120);
    if (!titulo) {
      return NextResponse.json({ error: "el título es obligatorio" }, { status: 400 });
    }
    sets.push("titulo = ?");
    valores.push(titulo);
  }
  if ("descripcion" in body) {
    sets.push("descripcion = ?");
    valores.push(String(body.descripcion ?? "").trim().slice(0, 300));
  }
  if ("multiple" in body) {
    sets.push("multiple = ?");
    valores.push(body.multiple ? 1 : 0);
  }
  if ("resultados" in body && resultadoValido(body.resultados)) {
    sets.push("resultados = ?");
    valores.push(body.resultados);
  }
  if ("abierta" in body) {
    sets.push("abierta = ?");
    valores.push(body.abierta ? 1 : 0);
  }
  if ("orden" in body) {
    sets.push("orden = ?");
    valores.push(Number(body.orden) || 0);
  }
  if (sets.length) {
    await ejecutar(`UPDATE votaciones SET ${sets.join(", ")} WHERE id = ?`, [
      ...valores,
      votacion.id,
    ]);
  }
  if (Array.isArray(body.opciones)) await sincronizarOpciones(votacion, body.opciones);

  const actualizada = await uno<Votacion>("SELECT * FROM votaciones WHERE id = ?", [
    votacion.id,
  ]);
  return NextResponse.json(await conDetalle(actualizada!));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug, id } = await params;
  const votacion = await buscar(slug, id);
  if (!votacion) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const imagenes = await consultar<{ imagen: string }>(
    "SELECT imagen FROM votacion_opciones WHERE votacion_id = ? AND imagen <> ''",
    [votacion.id]
  );
  await ejecutar("DELETE FROM votos WHERE votacion_id = ?", [votacion.id]);
  await ejecutar("DELETE FROM votacion_opciones WHERE votacion_id = ?", [votacion.id]);
  await ejecutar("DELETE FROM votaciones WHERE id = ?", [votacion.id]);
  for (const { imagen } of imagenes) await borrarArchivo(imagen);

  return NextResponse.json({ ok: true });
}
