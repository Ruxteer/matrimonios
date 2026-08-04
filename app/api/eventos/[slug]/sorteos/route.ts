import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type Sorteo } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// De dónde salen los participantes. El documento menciona una fuente "fotos",
// pero la tabla photos no guarda quién subió cada imagen, así que no se ofrece.
const FUENTES = ["invitados", "mensajes", "lista"] as const;

function fuenteValida(valor: unknown): (typeof FUENTES)[number] {
  return FUENTES.includes(valor as (typeof FUENTES)[number])
    ? (valor as (typeof FUENTES)[number])
    : "invitados";
}

function cantidadValida(valor: unknown): number {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 50);
}

/** Nombres escritos a mano en el panel: uno por línea, sin repetidos. */
function nombresDeLista(lista: string): string[] {
  const vistos = new Set<string>();
  const nombres: string[] = [];
  for (const linea of lista.split("\n")) {
    const nombre = linea.trim();
    const clave = nombre.toLowerCase();
    if (!nombre || vistos.has(clave)) continue;
    vistos.add(clave);
    nombres.push(nombre);
  }
  return nombres;
}

// El invitado solo ve lo publicado; el panel ve todo y además cuánta gente
// participa según la fuente de cada sorteo.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  if (!isAdmin(req)) {
    const publicados = await consultar<Omit<Sorteo, "evento_id" | "lista">>(
      `SELECT id, titulo, premio, fuente, cantidad, excluir_anteriores, publicado,
              ganadores, ejecutado_at, created_at
         FROM sorteos WHERE evento_id = ? AND publicado = 1 ORDER BY id`,
      [evento.id]
    );
    return NextResponse.json(publicados);
  }

  const sorteos = await consultar<Sorteo>(
    "SELECT * FROM sorteos WHERE evento_id = ? ORDER BY id",
    [evento.id]
  );
  const totales = await uno<{ invitados: number; mensajes: number }>(
    `SELECT
       (SELECT COUNT(DISTINCT LOWER(TRIM(nombre))) FROM guests
         WHERE evento_id = ?1 AND TRIM(nombre) <> '') AS invitados,
       (SELECT COUNT(DISTINCT LOWER(TRIM(nombre))) FROM messages
         WHERE evento_id = ?1 AND TRIM(nombre) <> '') AS mensajes`,
    [evento.id]
  );
  const cuantos = (s: Sorteo) => {
    if (s.fuente === "lista") return nombresDeLista(s.lista).length;
    if (s.fuente === "mensajes") return Number(totales?.mensajes ?? 0);
    return Number(totales?.invitados ?? 0);
  };
  return NextResponse.json(sorteos.map((s) => ({ ...s, participantes: cuantos(s) })));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const titulo = String(body?.titulo ?? "").trim().slice(0, 120);
  if (!titulo) {
    return NextResponse.json({ error: "el título es requerido" }, { status: 400 });
  }
  const res = await ejecutar(
    `INSERT INTO sorteos (evento_id, titulo, premio, fuente, lista, cantidad,
                          excluir_anteriores, publicado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evento.id,
      titulo,
      String(body?.premio ?? "").trim().slice(0, 120),
      fuenteValida(body?.fuente),
      String(body?.lista ?? "").trim().slice(0, 20000),
      cantidadValida(body?.cantidad ?? 1),
      body?.excluir_anteriores === false ? 0 : 1,
      body?.publicado === false ? 0 : 1,
    ]
  );
  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ?", [
    Number(res.lastInsertRowid),
  ]);
  return NextResponse.json(sorteo, { status: 201 });
}
