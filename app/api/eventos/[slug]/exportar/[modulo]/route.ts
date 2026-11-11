import { NextRequest, NextResponse } from "next/server";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { exportarModulo, MODULOS_EXPORTABLES, respuestaExportacion, type ModuloExportable } from "@/lib/exportar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ slug: string; modulo: string }> };

// Descarga de un módulo completo (sus mensajes, encuestas, votaciones, sorteos
// o trivias) en Excel o CSV. Puede traer correos: solo la baja quien administra.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug, modulo } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "No existe el evento." }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  if (!MODULOS_EXPORTABLES.includes(modulo as ModuloExportable)) {
    return NextResponse.json({ error: "Ese módulo no tiene descarga." }, { status: 404 });
  }
  const formato = req.nextUrl.searchParams.get("formato");
  if (formato !== "csv" && formato !== "xlsx") {
    return NextResponse.json({ error: "Formato no válido." }, { status: 400 });
  }
  const datos = await exportarModulo(modulo as ModuloExportable, evento.id);
  return respuestaExportacion(datos, formato, `${modulo}-${evento.slug}`);
}
