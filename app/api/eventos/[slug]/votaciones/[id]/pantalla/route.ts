import { NextRequest, NextResponse } from "next/server";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento, tokenPantallaValido } from "@/lib/eventos";
import { votacionParaPantalla } from "@/lib/votaciones";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Lo que consulta cada pocos segundos la pantalla en vivo de una votación. Se
// abre con la clave de la pantalla del salón (o la sesión del panel), igual
// que la pantalla de fotos y mensajes.
export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const clave = req.nextUrl.searchParams.get("k") ?? "";
  if (!tokenPantallaValido(evento, clave) && !puedeAdministrar(req, evento)) return noAutorizado();

  const votacion = await votacionParaPantalla(evento.id, Number(id));
  if (!votacion) return NextResponse.json({ error: "no existe" }, { status: 404 });
  return NextResponse.json(votacion, { headers: { "Cache-Control": "no-store" } });
}
