import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type Actividad } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

const LARGOS = { titulo: 120, descripcion: 500, lugar: 120, hora: 20, dia: 60 };

const texto = (valor: unknown, largo: number) => String(valor ?? "").trim().slice(0, largo);

// El programa lo ordena el organizador; la hora solo desempata cuando dos
// actividades quedaron en la misma posición.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const agenda = await consultar<Actividad>(
    "SELECT * FROM agenda WHERE evento_id = ? ORDER BY orden, hora",
    [evento.id]
  );
  return NextResponse.json(agenda);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const titulo = texto(body?.titulo, LARGOS.titulo);
  if (!titulo) {
    return NextResponse.json({ error: "El título es requerido." }, { status: 400 });
  }

  // La actividad nueva se va al final del programa.
  const ultima = await uno<{ maximo: number | null }>(
    "SELECT MAX(orden) AS maximo FROM agenda WHERE evento_id = ?",
    [evento.id]
  );
  const resultado = await ejecutar(
    `INSERT INTO agenda (evento_id, titulo, descripcion, lugar, hora, dia, orden)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      evento.id,
      titulo,
      texto(body?.descripcion, LARGOS.descripcion),
      texto(body?.lugar, LARGOS.lugar),
      texto(body?.hora, LARGOS.hora),
      texto(body?.dia, LARGOS.dia),
      Number(ultima?.maximo ?? 0) + 1,
    ]
  );
  const actividad = await uno<Actividad>("SELECT * FROM agenda WHERE id = ?", [
    Number(resultado.lastInsertRowid),
  ]);
  return NextResponse.json(actividad, { status: 201 });
}
