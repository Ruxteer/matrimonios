import { NextRequest, NextResponse } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento, regenerarTokenPantalla, tokenPantallaValido } from "@/lib/eventos";
import { datosPantalla } from "@/lib/pantalla";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// La pantalla se abre con la clave del evento (?k=) para no tener que escribir
// la contraseña del panel en el computador del salón; desde el panel funciona
// igual con la sesión ya abierta.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const clave = req.nextUrl.searchParams.get("k") ?? "";
  if (!tokenPantallaValido(evento, clave) && !isAdmin(req)) {
    return NextResponse.json({ error: "clave inválida" }, { status: 401 });
  }

  return NextResponse.json(await datosPantalla(evento.id), {
    headers: { "Cache-Control": "no-store" },
  });
}

// Cambiar la clave: el enlace anterior deja de servir (útil si el matrimonio
// ya pasó o si el enlace quedó dando vueltas en un computador prestado).
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  return NextResponse.json(await regenerarTokenPantalla(evento));
}
