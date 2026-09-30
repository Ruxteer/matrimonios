import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import type { Evento } from "./db";
import { consultar, ejecutar, uno } from "./db";
import { registroConfig, registroDisponible, type RegistroConfig } from "./registro";

export type Participante = {
  id: number;
  evento_id: number;
  nombre: string;
  email: string;
  email_normalizado: string;
  telefono: string;
  consentimiento_legal: number;
  consentimiento_informacion: number;
  consentimiento_marketing: number;
  campos_extra: string;
  consentimientos_at: string;
  consentimiento_version: string;
  token_hash: string;
  created_at: string;
  updated_at: string;
};

export function nombreCookieRegistro(evento: Pick<Evento, "id">): string {
  return `venito-registro-${evento.id}`;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** El correo nunca prueba la identidad. Solo la cookie opaca identifica su registro. */
export async function participanteActual(
  req: NextRequest | null,
  evento: Pick<Evento, "id">
): Promise<Participante | null> {
  const nombre = nombreCookieRegistro(evento);
  const token = req ? req.cookies.get(nombre)?.value : (await cookies()).get(nombre)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return uno<Participante>("SELECT * FROM participantes WHERE evento_id = ? AND token_hash = ?", [evento.id, hashToken(token)]);
}

export function establecerCookieRegistro(respuesta: NextResponse, evento: Pick<Evento, "id">, token: string) {
  respuesta.cookies.set(nombreCookieRegistro(evento), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

function camposGuardados(texto: string): Record<string, string> {
  try {
    const objeto: unknown = JSON.parse(texto);
    if (objeto && typeof objeto === "object" && !Array.isArray(objeto)) {
      return Object.fromEntries(Object.entries(objeto).filter(([, valor]) => typeof valor === "string"));
    }
  } catch { /* Una fila antigua sin JSON se trata como vacía. */ }
  return {};
}

/** Solo se entrega al dueño de la cookie o a un administrador autorizado. */
export function participantePublico(participante: Participante) {
  return {
    id: participante.id,
    nombre: participante.nombre,
    email: participante.email,
    telefono: participante.telefono,
    consentimiento_legal: Boolean(participante.consentimiento_legal),
    consentimiento_informacion: Boolean(participante.consentimiento_informacion),
    consentimiento_marketing: Boolean(participante.consentimiento_marketing),
    campos_extra: camposGuardados(participante.campos_extra),
    consentimientos_at: participante.consentimientos_at,
    created_at: participante.created_at,
    updated_at: participante.updated_at,
  };
}

export function evidenciaConsentimiento(participante: Participante) {
  let datos: Record<string, unknown> = {};
  try {
    const crudo: unknown = JSON.parse(participante.consentimiento_version);
    if (crudo && typeof crudo === "object" && !Array.isArray(crudo)) datos = crudo as Record<string, unknown>;
  } catch { /* Las filas previas no siempre guardaban la versión de los textos. */ }
  const texto = (campo: string) => typeof datos[campo] === "string" ? datos[campo] as string : "";
  return {
    consentimiento_texto: texto("consentimiento_texto"),
    terminos_url: texto("terminos_url"),
    privacidad_url: texto("privacidad_url"),
    informacion_texto: texto("informacion_texto"),
    marketing_texto: texto("marketing_texto"),
  };
}

export async function fotosDeParticipante(evento: Pick<Evento, "id">, participante: Pick<Participante, "id">): Promise<number> {
  const fila = await uno<{ total: number }>("SELECT COUNT(*) AS total FROM photos WHERE evento_id = ? AND participante_id = ?", [evento.id, participante.id]);
  return fila?.total ?? 0;
}

export type DatosRegistro = {
  nombre: string;
  email: string;
  email_normalizado: string;
  telefono: string;
  consentimiento_informacion: boolean;
  consentimiento_marketing: boolean;
  campos_extra: Record<string, string>;
};

export function validarDatosRegistro(valor: unknown, config: RegistroConfig):
  { ok: true; datos: DatosRegistro } | { ok: false; error: string } {
  const body = valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
  const nombre = typeof body.nombre === "string" ? body.nombre.trim().replace(/\s+/g, " ") : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const telefono = typeof body.telefono === "string" ? body.telefono.trim() : "";
  if (nombre.length < 2 || nombre.length > 120 || /[\u0000-\u001f\u007f]/.test(nombre)) return { ok: false, error: "Escribe tu nombre completo (entre 2 y 120 caracteres)." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Escribe un correo electrónico válido." };
  if ((config.telefono_obligatorio && !telefono) || (telefono && (telefono.length > 32 || !/^\+?[\d\s().-]+$/.test(telefono) || telefono.replace(/\D/g, "").length < 7 || telefono.replace(/\D/g, "").length > 15))) return { ok: false, error: "Escribe un teléfono válido con su código de país." };
  if (body.consentimiento_legal !== true) return { ok: false, error: "Debes aceptar los términos y la política de privacidad para participar." };
  const extras = body.campos_extra && typeof body.campos_extra === "object" && !Array.isArray(body.campos_extra) ? body.campos_extra as Record<string, unknown> : {};
  const campos: Record<string, string> = {};
  for (const campo of config.campos_extra) {
    const valorExtra = extras[campo.id];
    const respuesta = typeof valorExtra === "string" ? valorExtra.trim() : "";
    if (campo.obligatorio && !respuesta) return { ok: false, error: `Completa el campo «${campo.label}».` };
    if (respuesta.length > 500) return { ok: false, error: `El campo «${campo.label}» debe tener hasta 500 caracteres.` };
    campos[campo.id] = respuesta;
  }
  return { ok: true, datos: {
    nombre, email, email_normalizado: email.normalize("NFC").toLowerCase(), telefono,
    consentimiento_informacion: body.consentimiento_informacion === true,
    consentimiento_marketing: body.consentimiento_marketing === true,
    campos_extra: campos,
  } };
}

const ERROR_REPETIDO = "No pudimos completar este registro. Si ya participaste, continúa desde el dispositivo original o contacta a la organización.";

export async function guardarRegistro(req: NextRequest, evento: Evento, body: unknown): Promise<
  { ok: true; participante: Participante; token: string | null; nuevo: boolean } |
  { ok: false; error: string; status: number }
> {
  const config = registroConfig(evento);
  if (!registroDisponible(config)) return { ok: false, error: "El registro está cerrado en este momento.", status: 403 };
  if (!config.terminos_url || !config.privacidad_url || !config.consentimiento_texto) return { ok: false, error: "La organización está preparando los términos y la privacidad del registro.", status: 403 };
  const validado = validarDatosRegistro(body, config);
  if (!validado.ok) return { ok: false, error: validado.error, status: 400 };
  const datos = validado.datos;
  const actual = await participanteActual(req, evento);
  if (actual) datos.campos_extra = { ...camposGuardados(actual.campos_extra), ...datos.campos_extra };
  const consentimiento = JSON.stringify({
    terminos_url: config.terminos_url, privacidad_url: config.privacidad_url,
    consentimiento_texto: config.consentimiento_texto, informacion_texto: config.informacion_texto,
    marketing_texto: config.marketing_texto,
  });
  const valores = [datos.nombre, datos.email, datos.email_normalizado, datos.telefono,
    datos.consentimiento_informacion ? 1 : 0, datos.consentimiento_marketing ? 1 : 0,
    JSON.stringify(datos.campos_extra), consentimiento];
  if (actual) {
    const result = await ejecutar(`UPDATE participantes SET nombre = ?, email = ?, email_normalizado = ?, telefono = ?,
      consentimiento_legal = 1, consentimiento_informacion = ?, consentimiento_marketing = ?,
      campos_extra = ?, consentimiento_version = ?, consentimientos_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND evento_id = ? AND NOT EXISTS
      (SELECT 1 FROM participantes WHERE evento_id = ? AND email_normalizado = ? AND id <> ?)`,
    [...valores, actual.id, evento.id, evento.id, datos.email_normalizado, actual.id]);
    if (!result.rowsAffected) return { ok: false, error: ERROR_REPETIDO, status: 409 };
    return { ok: true, participante: (await uno<Participante>("SELECT * FROM participantes WHERE id = ? AND evento_id = ?", [actual.id, evento.id]))!, token: null, nuevo: false };
  }
  // La unicidad y el cupo se evalúan en el mismo INSERT para resistir solicitudes simultáneas.
  const token = crypto.randomBytes(32).toString("hex");
  const result = await ejecutar(`INSERT INTO participantes
    (nombre, email, email_normalizado, telefono, consentimiento_legal, consentimiento_informacion,
    consentimiento_marketing, campos_extra, consentimiento_version, consentimientos_at, evento_id, token_hash)
    SELECT ?, ?, ?, ?, 1, ?, ?, ?, ?, datetime('now'), ?, ?
    WHERE (? = 0 OR (SELECT COUNT(*) FROM participantes WHERE evento_id = ?) < ?)
    ON CONFLICT (evento_id, email_normalizado) DO NOTHING`,
  [...valores, evento.id, hashToken(token), config.capacidad, evento.id, config.capacidad]);
  if (!result.rowsAffected) return { ok: false, error: "No pudimos completar este registro. Verifica tus datos o consulta con la organización sobre los cupos disponibles.", status: 409 };
  return { ok: true, participante: (await uno<Participante>("SELECT * FROM participantes WHERE evento_id = ? AND token_hash = ?", [evento.id, hashToken(token)]))!, token, nuevo: true };
}

export async function listarParticipantes(evento: Evento, pagina = 1, buscar = "") {
  const termino = buscar.trim().slice(0, 120);
  const condicion = termino ? " AND (nombre LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR telefono LIKE ? ESCAPE '\\')" : "";
  const patron = `%${termino.replace(/[\\%_]/g, "\\$&")}%`;
  const args = termino ? [evento.id, patron, patron, patron] : [evento.id];
  const total = (await uno<{ total: number }>(`SELECT COUNT(*) AS total FROM participantes WHERE evento_id = ?${condicion}`, args))?.total ?? 0;
  const porPagina = 25;
  const paginaValida = Math.min(Math.max(1, Math.floor(pagina) || 1), Math.max(1, Math.ceil(total / porPagina)));
  const filas = await consultar<Participante & { fotos: number }>(`SELECT participantes.*,
    (SELECT COUNT(*) FROM photos WHERE photos.evento_id = participantes.evento_id AND photos.participante_id = participantes.id) AS fotos
    FROM participantes WHERE evento_id = ?${condicion} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
  [...args, porPagina, (paginaValida - 1) * porPagina]);
  return { participantes: filas.map((p) => ({ ...participantePublico(p), fotos: p.fotos })), total, pagina: paginaValida, por_pagina: porPagina };
}
