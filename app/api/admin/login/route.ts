import { NextRequest, NextResponse } from "next/server";
import {
  checkPassword,
  claveEventoValida,
  cookieEvento,
  sessionToken,
} from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

const COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60, // 60 días
};

// Con `slug` se entra al panel de un matrimonio: sirve tanto la clave maestra
// como la que pusieron los novios. Sin `slug` (la lista de matrimonios) solo
// vale la maestra.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "");
  const slug = String(body?.slug ?? "").trim();

  if (checkPassword(password)) {
    const res = NextResponse.json({ ok: true, maestra: true });
    res.cookies.set("admin", sessionToken(), COOKIE);
    return res;
  }

  if (slug) {
    const evento = await getEvento(slug);
    if (evento && claveEventoValida(evento, password)) {
      const res = NextResponse.json({ ok: true, maestra: false });
      res.cookies.set("evento", cookieEvento(evento), COOKIE);
      return res;
    }
  }

  return NextResponse.json({ error: "contraseña incorrecta" }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin", "", { ...COOKIE, maxAge: 0 });
  res.cookies.set("evento", "", { ...COOKIE, maxAge: 0 });
  return res;
}
