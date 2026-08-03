import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Contraseña del panel: se define en .env.local (ADMIN_PASSWORD).
// Si no hay contraseña configurada, el panel queda cerrado.
function password(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

function hash(s: string): Buffer {
  return crypto.createHash("sha256").update(s).digest();
}

// Token de sesión sin estado, derivado de la contraseña:
// cambiar ADMIN_PASSWORD invalida todas las sesiones abiertas.
export function sessionToken(): string {
  return crypto.createHmac("sha256", password()).update("sesion-admin").digest("hex");
}

export function checkPassword(intento: string): boolean {
  return password().length > 0 && crypto.timingSafeEqual(hash(intento), hash(password()));
}

export function isAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get("admin")?.value ?? "";
  return password().length > 0 && crypto.timingSafeEqual(hash(cookie), hash(sessionToken()));
}

export function noAutorizado(): NextResponse {
  return NextResponse.json({ error: "no autorizado" }, { status: 401 });
}
