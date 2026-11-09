import { NextRequest, NextResponse } from "next/server";
import { uno, type Evento, type Sorteo } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento, tokenPantallaValido } from "@/lib/eventos";
import { llegoLaHora, realizarSorteo, sorteoParaPantalla } from "@/lib/sorteos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ slug: string; id: string }> };

// La pantalla del sorteo se abre con la clave de la pantalla del salón (o con
// la sesión del panel), igual que la de fotos y mensajes.
async function cargar(req: NextRequest, ctx: Ctx): Promise<{ evento: Evento; sorteo: Sorteo } | NextResponse> {
  const { slug, id } = await ctx.params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const clave = req.nextUrl.searchParams.get("k") ?? "";
  if (!tokenPantallaValido(evento, clave) && !puedeAdministrar(req, evento)) return noAutorizado();
  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (!sorteo) return NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 });
  return { evento, sorteo };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const cargado = await cargar(req, ctx);
  if (cargado instanceof NextResponse) return cargado;
  const nombres = req.nextUrl.searchParams.get("nombres") === "1";
  const conteo = req.nextUrl.searchParams.get("conteo") !== "0";
  return NextResponse.json(await sorteoParaPantalla(cargado.sorteo, cargado.evento.id, { nombres, conteo }), {
    headers: { "Cache-Control": "no-store" },
  });
}

// El botón «Realizar sorteo» de la pantalla. Sortea una sola vez y solo cuando
// llegó la hora: volver a sortear es una decisión del panel, no de quien tenga
// el notebook del salón.
export async function POST(req: NextRequest, ctx: Ctx) {
  const cargado = await cargar(req, ctx);
  if (cargado instanceof NextResponse) return cargado;
  const { evento, sorteo } = cargado;
  if (sorteo.ejecutado_at) {
    return NextResponse.json({ error: "Este sorteo ya se realizó." }, { status: 409 });
  }
  if (!llegoLaHora(sorteo)) {
    return NextResponse.json({ error: "Todavía no es la hora del sorteo." }, { status: 409 });
  }
  const resultado = await realizarSorteo(sorteo, evento.id, { soloSiPendiente: true });
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  return NextResponse.json(await sorteoParaPantalla(resultado.sorteo, evento.id));
}
