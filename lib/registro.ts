import type { Evento } from "./db";

export type CampoRegistro = { id: string; label: string; obligatorio: boolean };

export type RegistroConfig = {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  confirmacion: string;
  siguiente_paso: string;
  terminos_url: string;
  privacidad_url: string;
  consentimiento_texto: string;
  informacion_texto: string;
  marketing_texto: string;
  telefono_obligatorio: boolean;
  fotos_por_participante: number;
  fotos_requiere_registro: boolean;
  fotos_moderacion: boolean;
  capacidad: number;
  inicio: string;
  fin: string;
  campos_extra: CampoRegistro[];
};

export const REGISTRO_DEFAULT: RegistroConfig = {
  abierto: true,
  titulo: "Regístrate para participar",
  descripcion: "Completa tus datos para participar en el evento y compartir tu experiencia.",
  confirmacion: "Tu registro está listo. ¡Gracias por participar!",
  siguiente_paso: "Comparte tu foto del evento",
  terminos_url: "",
  privacidad_url: "",
  consentimiento_texto: "Acepto los términos y la política de privacidad para participar en este evento.",
  informacion_texto: "Quiero recibir información del evento y el acceso a sus fotografías.",
  marketing_texto: "Quiero recibir novedades y comunicaciones promocionales de la organización.",
  telefono_obligatorio: true,
  fotos_por_participante: 1,
  fotos_requiere_registro: true,
  fotos_moderacion: true,
  capacidad: 0,
  inicio: "",
  fin: "",
  campos_extra: [],
};

const IDS_RESERVADOS = new Set(["__proto__", "constructor", "prototype"]);

function fechaValida(valor: unknown): boolean {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(valor)) return false;
  const dia = valor.slice(0, 10);
  const fechaDia = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(Date.parse(valor)) && !Number.isNaN(fechaDia.getTime()) && fechaDia.toISOString().startsWith(dia);
}

/** El panel puede guardar un borrador; fechas inválidas se corrigen antes de guardar. */
export function errorRegistroConfig(valor: unknown): string | null {
  let crudo = valor;
  if (typeof crudo === "string") {
    try { crudo = JSON.parse(crudo); } catch { return "La configuración del registro no es válida."; }
  }
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return "La configuración del registro no es válida.";
  const data = crudo as Record<string, unknown>;
  for (const campo of ["inicio", "fin"] as const) {
    if (data[campo] !== undefined && data[campo] !== "" && !fechaValida(data[campo])) return "Revisa las fechas de apertura y cierre del registro.";
  }
  if (data.inicio && data.fin && Date.parse(String(data.inicio)) > Date.parse(String(data.fin))) return "El cierre debe ser posterior a la apertura del registro.";
  if (Array.isArray(data.campos_extra)) {
    for (const campo of data.campos_extra) {
      if (campo && typeof campo === "object" && typeof campo.id === "string" && IDS_RESERVADOS.has(campo.id.toLowerCase())) return "El identificador de un campo adicional no es válido.";
    }
  }
  return null;
}

function texto(valor: unknown, defecto: string, largo: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, largo) : defecto;
}

/** Enlaces internos o HTTPS. Nunca se aceptan esquemas ejecutables. */
export function urlRegistroValida(valor: unknown): string {
  const url = texto(valor, "", 2000);
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function fecha(valor: unknown): string {
  if (!fechaValida(valor)) return "";
  const d = new Date(valor as string);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function entero(valor: unknown, defecto: number, minimo: number, maximo: number): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(minimo, Math.min(maximo, Math.floor(numero))) : defecto;
}

/** Configuración compartida por el panel, el formulario y los endpoints. */
export function registroConfig(evento: Pick<Evento, "registro_config"> | string): RegistroConfig {
  return configurar(typeof evento === "string" ? evento : evento.registro_config);
}

function configurar(valor: unknown): RegistroConfig {
  let crudo = valor;
  if (typeof valor === "string") {
    try { crudo = JSON.parse(valor); } catch { crudo = {}; }
  }
  const data = crudo && typeof crudo === "object" && !Array.isArray(crudo)
    ? crudo as Record<string, unknown> : {};
  const defaults = REGISTRO_DEFAULT;
  const booleano = (campo: keyof RegistroConfig): boolean =>
    typeof data[campo] === "boolean" ? data[campo] as boolean : defaults[campo] as boolean;
  const campos: CampoRegistro[] = [];
  const vistos = new Set<string>();
  if (Array.isArray(data.campos_extra)) {
    for (const item of data.campos_extra) {
      if (!item || typeof item !== "object") continue;
      const id = texto(item.id, "", 40).toLowerCase().replace(/[^a-z0-9_-]/g, "");
      const label = texto(item.label, "", 120);
      if (!id || !label || IDS_RESERVADOS.has(id) || vistos.has(id)) continue;
      vistos.add(id);
      campos.push({ id, label, obligatorio: item.obligatorio === true });
      if (campos.length === 8) break;
    }
  }
  return {
    abierto: booleano("abierto"),
    titulo: texto(data.titulo, defaults.titulo, 200),
    descripcion: texto(data.descripcion, defaults.descripcion, 2000),
    confirmacion: texto(data.confirmacion, defaults.confirmacion, 2000),
    siguiente_paso: texto(data.siguiente_paso, defaults.siguiente_paso, 300),
    terminos_url: urlRegistroValida(data.terminos_url),
    privacidad_url: urlRegistroValida(data.privacidad_url),
    consentimiento_texto: texto(data.consentimiento_texto, defaults.consentimiento_texto, 2000),
    informacion_texto: texto(data.informacion_texto, defaults.informacion_texto, 2000),
    marketing_texto: texto(data.marketing_texto, defaults.marketing_texto, 2000),
    telefono_obligatorio: booleano("telefono_obligatorio"),
    fotos_por_participante: entero(data.fotos_por_participante ?? 1, 1, 1, 100),
    fotos_requiere_registro: booleano("fotos_requiere_registro"),
    fotos_moderacion: booleano("fotos_moderacion"),
    capacidad: entero(data.capacidad ?? 0, 0, 0, 1000000),
    inicio: fecha(data.inicio),
    fin: fecha(data.fin),
    campos_extra: campos,
  };
}

export function normalizarRegistroConfig(valor: unknown): string {
  return JSON.stringify(configurar(valor));
}

export function registroDisponible(config: RegistroConfig, ahora = Date.now()): boolean {
  return config.abierto && (!config.inicio || ahora >= Date.parse(config.inicio))
    && (!config.fin || ahora <= Date.parse(config.fin));
}
