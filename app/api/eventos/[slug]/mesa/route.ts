import { NextRequest, NextResponse } from "next/server";
import { db, Guest } from "@/lib/db";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const q = normalizar(req.nextUrl.searchParams.get("q") ?? "");
  if (!q) return NextResponse.json({ results: [] });

  const invitados = db()
    .prepare("SELECT * FROM guests WHERE evento_id = ?")
    .all(evento.id) as Guest[];

  const encontrados = invitados
    .filter((g) => {
      const n = normalizar(g.nombre);
      return n.includes(q) || q.includes(n);
    })
    .slice(0, 5);

  const results = encontrados.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    mesa: g.mesa,
    companions: invitados
      .filter((o) => o.mesa && o.mesa === g.mesa && o.id !== g.id)
      .map((o) => o.nombre)
      .sort((a, b) => a.localeCompare(b, "es")),
  }));

  return NextResponse.json({ results });
}
