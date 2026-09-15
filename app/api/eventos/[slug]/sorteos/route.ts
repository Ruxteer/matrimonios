import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type Sorteo } from "@/lib/db";
import { muestraBase, participantesDeSorteo } from "@/lib/sorteos";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// De dónde salen los participantes. El documento menciona una fuente "fotos",
// pero la tabla photos no guarda quién subió cada imagen, así que no se ofrece.
const FUENTES = ["invitados", "mensajes", "lista", "base"] as const;

function fuenteValida(valor: unknown): (typeof FUENTES)[number] {
  return FUENTES.includes(valor as (typeof FUENTES)[number])
    ? (valor as (typeof FUENTES)[number])
    : "invitados";
}

function cantidadValida(valor: unknown, min = 1, max = 50): number {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n) || n < min) return min;
  return Math.min(n, max);
}

// El invitado solo ve lo publicado y solo los nombres; el panel ve todo, con
// cuánta gente participa y, si hay base importada, una muestra de sus filas.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  if (!puedeAdministrar(req, evento)) {
    // Columnas nombradas una por una: `detalle` y la base traen datos personales.
    const publicados = await consultar<Record<string, unknown>>(
      `SELECT id, titulo, premio, cantidad, publicado, ganadores, suplentes,
              ejecutado_at, created_at
         FROM sorteos WHERE evento_id = ? AND publicado = 1 ORDER BY id`,
      [evento.id]
    );
    return NextResponse.json(publicados);
  }

  const sorteos = await consultar<Sorteo>(
    "SELECT * FROM sorteos WHERE evento_id = ? ORDER BY id",
    [evento.id]
  );
  const conDatos = await Promise.all(
    sorteos.map(async (s) => ({
      ...s,
      participantes: (await participantesDeSorteo(s, evento.id)).length,
      base: s.base_nombre ? await muestraBase(s.id) : null,
    }))
  );
  return NextResponse.json(conDatos);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const body = await req.json().catch(() => null);
  const titulo = String(body?.titulo ?? "").trim().slice(0, 120);
  if (!titulo) {
    return NextResponse.json({ error: "el título es requerido" }, { status: 400 });
  }
  const res = await ejecutar(
    `INSERT INTO sorteos (evento_id, titulo, premio, fuente, lista, cantidad,
                          cantidad_suplentes, excluir_anteriores, publicado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evento.id,
      titulo,
      String(body?.premio ?? "").trim().slice(0, 120),
      fuenteValida(body?.fuente),
      String(body?.lista ?? "").trim().slice(0, 20000),
      cantidadValida(body?.cantidad ?? 1),
      cantidadValida(body?.cantidad_suplentes ?? 0, 0, 20),
      body?.excluir_anteriores === false ? 0 : 1,
      body?.publicado === false ? 0 : 1,
    ]
  );
  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ?", [
    Number(res.lastInsertRowid),
  ]);
  return NextResponse.json(sorteo, { status: 201 });
}
