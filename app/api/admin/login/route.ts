import { NextRequest, NextResponse } from "next/server";
import { checkPassword, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60, // 60 días
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!checkPassword(String(body?.password ?? ""))) {
    return NextResponse.json({ error: "contraseña incorrecta" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin", sessionToken(), COOKIE);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin", "", { ...COOKIE, maxAge: 0 });
  return res;
}
