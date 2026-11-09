import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type PreguntaTrivia, type Trivia } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { borrarArchivo } from "@/lib/archivos";
import { archivoSubido } from "@/lib/urls";
import { imagenesDeTrivia, preguntaPanel } from "@/lib/trivia";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

type Partida = { participante: string; puntaje: number; total: number };

function texto(valor: unknown, max: number): string {
  return String(valor ?? "").trim().slice(0, max);
}

// Ninguna trivia se toca por id a secas: tiene que ser del matrimonio del slug.
async function buscar(slug: string, id: string): Promise<Trivia | null> {
  const evento = await getEvento(slug);
  if (!evento) return null;
  return uno<Trivia>("SELECT * FROM trivias WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
}

// El panel siempre recibe la trivia completa: preguntas, cuánto se jugó y cómo
// les fue, que es lo mismo que devuelve el listado.
async function paraElPanel(trivia: Trivia) {
  const preguntas = await consultar<PreguntaTrivia>(
    "SELECT * FROM trivia_preguntas WHERE trivia_id = ? ORDER BY orden, id",
    [trivia.id]
  );
  const partidas = await consultar<Partida>(
    `SELECT participante, puntaje, total FROM trivia_partidas
      WHERE trivia_id = ? ORDER BY puntaje DESC, created_at ASC`,
    [trivia.id]
  );
  return {
    ...trivia,
    preguntas: preguntas.map(preguntaPanel),
    partidas: partidas.length,
    promedio: partidas.length
      ? Math.round((partidas.reduce((s, p) => s + p.puntaje, 0) / partidas.length) * 10) / 10
      : 0,
    ranking: partidas.slice(0, 10),
  };
}

// Las preguntas llegan como la lista completa y en el orden en que quedaron:
// las que traen id se actualizan, las nuevas se crean y las que ya no vienen
// se borran. Cada alternativa trae texto, foto o las dos (puede llegar como
// texto suelto, el formato de antes, o como { texto, imagen }).
async function guardarPreguntas(trivia: Trivia, crudas: unknown[]) {
  const existentes = await consultar<{ id: number; imagenes: string }>(
    "SELECT id, imagenes FROM trivia_preguntas WHERE trivia_id = ?",
    [trivia.id]
  );
  const vivas = new Set<number>();
  const fotosVivas = new Set<string>();
  let orden = 0;

  for (const cruda of crudas) {
    const p = (cruda ?? {}) as Record<string, unknown>;
    const enunciado = texto(p.enunciado, 300);
    // Las vacías se descartan, pero las correctas vienen con los índices de la
    // lista original: se traducen a la lista que queda.
    const nuevoIndice = new Map<number, number>();
    const opciones: string[] = [];
    const imagenes: string[] = [];
    (Array.isArray(p.opciones) ? (p.opciones as unknown[]) : []).forEach((o, i) => {
      const alternativa = (o && typeof o === "object" ? o : { texto: o }) as Record<string, unknown>;
      const textoAlternativa = texto(alternativa.texto, 160);
      const imagen = archivoSubido(alternativa.imagen);
      if ((!textoAlternativa && !imagen) || opciones.length >= 8) return;
      nuevoIndice.set(i, opciones.length);
      opciones.push(textoAlternativa);
      imagenes.push(imagen);
    });
    // Una pregunta sin enunciado o con una sola alternativa no se puede jugar.
    if (!enunciado || opciones.length < 2) continue;

    const multiple = p.multiple === false || p.multiple === 0 ? 0 : 1;
    let marcadas = [
      ...new Set(
        (Array.isArray(p.correctas) ? (p.correctas as unknown[]) : [])
          .map((i) => nuevoIndice.get(Number(i)))
          .filter((i): i is number => i !== undefined)
      ),
    ].sort((a, b) => a - b);
    // Con selección única se elige una sola: solo puede haber una correcta.
    if (!multiple) marcadas = marcadas.slice(0, 1);
    const explicacion = texto(p.explicacion, 300);
    const id = Number(p.id);
    const conFotos = imagenes.some(Boolean);
    imagenes.filter(Boolean).forEach((f) => fotosVivas.add(f));
    const datos = [
      enunciado,
      JSON.stringify(opciones),
      JSON.stringify(marcadas),
      explicacion,
      conFotos ? JSON.stringify(imagenes) : "",
      multiple,
      orden++,
    ];

    if (existentes.some((e) => e.id === id)) {
      vivas.add(id);
      await ejecutar(
        `UPDATE trivia_preguntas
            SET enunciado = ?, opciones = ?, correctas = ?, explicacion = ?, imagenes = ?,
                multiple = ?, orden = ?
          WHERE id = ? AND trivia_id = ?`,
        [...datos, id, trivia.id]
      );
    } else {
      await ejecutar(
        `INSERT INTO trivia_preguntas
           (trivia_id, enunciado, opciones, correctas, explicacion, imagenes, multiple, orden)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [trivia.id, ...datos]
      );
    }
  }

  for (const e of existentes) {
    if (!vivas.has(e.id)) {
      await ejecutar("DELETE FROM trivia_preguntas WHERE id = ?", [e.id]);
    }
  }
  // Las fotos que ya no usa ninguna alternativa se borran del almacenamiento.
  const antes = existentes.flatMap((e) => imagenesDeTrivia(e.imagenes));
  for (const foto of new Set(antes)) {
    if (!fotosVivas.has(foto)) await borrarArchivo(foto);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const trivia = await buscar(slug, id);
  if (!trivia) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const valores: (string | number)[] = [];

  if ("titulo" in body) {
    const titulo = texto(body.titulo, 120);
    if (!titulo) {
      return NextResponse.json({ error: "el título es requerido" }, { status: 400 });
    }
    sets.push("titulo = ?");
    valores.push(titulo);
  }
  if ("descripcion" in body) {
    sets.push("descripcion = ?");
    valores.push(texto(body.descripcion, 400));
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
    await ejecutar(`UPDATE trivias SET ${sets.join(", ")} WHERE id = ?`, [
      ...valores,
      trivia.id,
    ]);
  }
  if (Array.isArray(body.preguntas)) {
    await guardarPreguntas(trivia, body.preguntas as unknown[]);
  }

  const actualizada = (await uno<Trivia>("SELECT * FROM trivias WHERE id = ?", [trivia.id]))!;
  return NextResponse.json(await paraElPanel(actualizada));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const trivia = await buscar(slug, id);
  if (!trivia) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const fotos = await consultar<{ imagenes: string }>(
    "SELECT imagenes FROM trivia_preguntas WHERE trivia_id = ?",
    [trivia.id]
  );
  await ejecutar("DELETE FROM trivia_preguntas WHERE trivia_id = ?", [trivia.id]);
  await ejecutar("DELETE FROM trivia_partidas WHERE trivia_id = ?", [trivia.id]);
  await ejecutar("DELETE FROM trivias WHERE id = ?", [trivia.id]);
  for (const f of fotos) for (const foto of imagenesDeTrivia(f.imagenes)) await borrarArchivo(foto);
  return NextResponse.json({ ok: true });
}
