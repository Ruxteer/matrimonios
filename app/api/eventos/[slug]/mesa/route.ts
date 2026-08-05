import { NextRequest, NextResponse } from "next/server";
import { consultar, Guest } from "@/lib/db";
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
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const q = normalizar(req.nextUrl.searchParams.get("q") ?? "");
  if (!q) return NextResponse.json({ results: [] });

  const invitados = await consultar<Guest>(
    "SELECT * FROM guests WHERE evento_id = ?",
    [evento.id]
  );

  // Mientras el invitado escribe se le ofrecen nombres parecidos, para que no
  // tenga que escribirlo entero ni acertarle a la tilde. Van solo los nombres:
  // la mesa y con quién se sienta se ven recién al elegir uno.
  if (req.nextUrl.searchParams.get("sugerencias") === "1") {
    if (q.length < 2) return NextResponse.json({ sugerencias: [] });
    const empieza: string[] = [];
    const contiene: string[] = [];
    for (const g of invitados) {
      const n = normalizar(g.nombre);
      if (n.split(/\s+/).some((palabra) => palabra.startsWith(q))) empieza.push(g.nombre);
      else if (n.includes(q)) contiene.push(g.nombre);
    }
    const orden = (a: string, b: string) => a.localeCompare(b, "es");
    return NextResponse.json({
      sugerencias: [...empieza.sort(orden), ...contiene.sort(orden)].slice(0, 6),
    });
  }

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
