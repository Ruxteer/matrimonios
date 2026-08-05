import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Evento } from "./db";

// Hay dos formas de entrar al panel:
//
//   · La clave maestra (ADMIN_PASSWORD, en .env.local). Abre todos los
//     matrimonios y es la única que puede crear y eliminar matrimonios. Es la
//     de quien vende el producto.
//   · La clave de cada matrimonio, que ponen los novios en su propio panel.
//     Abre solo el suyo: sus invitados, sus votaciones, sus fotos.
//
// Si no hay ADMIN_PASSWORD configurada, el panel maestro queda cerrado.

function password(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

function hash(s: string): Buffer {
  return crypto.createHash("sha256").update(s).digest();
}

// Compara sin filtrar por el tiempo cuánto coincide. Los dos lados pasan por
// hash primero, así que siempre miden lo mismo y no revientan por largo.
function iguales(a: string, b: string): boolean {
  return crypto.timingSafeEqual(hash(a), hash(b));
}

// ------------------------------------------------------------ clave maestra

// Token de sesión sin estado, derivado de la contraseña:
// cambiar ADMIN_PASSWORD invalida todas las sesiones abiertas.
export function sessionToken(): string {
  return crypto.createHmac("sha256", password()).update("sesion-admin").digest("hex");
}

export function checkPassword(intento: string): boolean {
  return password().length > 0 && iguales(intento, password());
}

// Sirve para las rutas de API (NextRequest) y también para los componentes de
// servidor, que leen la cookie con cookies() de next/headers.
export function cookieAdminValida(cookie: string): boolean {
  return password().length > 0 && iguales(cookie, sessionToken());
}

export function isAdmin(req: NextRequest): boolean {
  return cookieAdminValida(req.cookies.get("admin")?.value ?? "");
}

// ------------------------------------------------- clave de cada matrimonio

const LARGO_MINIMO = 6;

/** Prepara una clave para guardarla: sal al azar y hash, nunca el texto. */
export function guardarClave(clave: string): string | null {
  const limpia = clave.trim();
  if (limpia.length < LARGO_MINIMO) return null;
  const sal = crypto.randomBytes(8).toString("hex");
  return `${sal}:${crypto.createHash("sha256").update(sal + limpia).digest("hex")}`;
}

export function claveEventoValida(evento: Evento, intento: string): boolean {
  const guardada = evento.clave ?? "";
  const [sal, esperado] = guardada.split(":");
  if (!sal || !esperado) return false;
  const calculado = crypto.createHash("sha256").update(sal + intento.trim()).digest("hex");
  return iguales(calculado, esperado);
}

// La sesión de los novios va atada al matrimonio y a su clave: cambiar la clave
// cierra las sesiones abiertas, igual que la maestra.
export function tokenEvento(evento: Evento): string {
  return crypto
    .createHmac("sha256", password())
    .update(`evento:${evento.id}:${evento.clave}`)
    .digest("hex");
}

/** Valor de la cookie: dice de qué matrimonio es, para no servir a otro. */
export function cookieEvento(evento: Evento): string {
  return `${evento.id}.${tokenEvento(evento)}`;
}

export function esAdminDeEvento(req: NextRequest, evento: Evento): boolean {
  if (!evento.clave) return false;
  const cookie = req.cookies.get("evento")?.value ?? "";
  const corte = cookie.indexOf(".");
  if (corte < 1) return false;
  if (Number(cookie.slice(0, corte)) !== evento.id) return false;
  return iguales(cookie.slice(corte + 1), tokenEvento(evento));
}

/**
 * Quién puede tocar el contenido de un matrimonio: la clave maestra o los
 * novios de ese matrimonio. Crear y eliminar matrimonios sigue siendo solo de
 * la maestra (esas rutas usan isAdmin directamente).
 */
export function puedeAdministrar(req: NextRequest, evento: Evento): boolean {
  return isAdmin(req) || esAdminDeEvento(req, evento);
}

/** Id del matrimonio cuya sesión trae la petición, para las rutas sin slug. */
export function eventoDeLaSesion(req: NextRequest): number | null {
  const cookie = req.cookies.get("evento")?.value ?? "";
  const corte = cookie.indexOf(".");
  if (corte < 1) return null;
  const id = Number(cookie.slice(0, corte));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function noAutorizado(): NextResponse {
  return NextResponse.json({ error: "no autorizado" }, { status: 401 });
}
