import type { Evento } from "./db";

// Cuánto muestra a la vez la pantalla en vivo: de una a cuatro fotos y de uno a
// cuatro mensajes por escena. Se elige en las pestañas Fotos y Mensajes.
// Sin dependencias del servidor: lo usan el panel y la pantalla.

export type CantidadPantalla = 1 | 2 | 3 | 4;
export type PantallaConfig = { fotos: CantidadPantalla; mensajes: CantidadPantalla };

export const PANTALLA_DEFAULT: PantallaConfig = { fotos: 1, mensajes: 1 };
export const CANTIDADES: CantidadPantalla[] = [1, 2, 3, 4];

function cantidad(valor: unknown, defecto: CantidadPantalla): CantidadPantalla {
  const n = Number(valor);
  return CANTIDADES.includes(n as CantidadPantalla) ? (n as CantidadPantalla) : defecto;
}

function limpiar(valor: unknown): PantallaConfig {
  let crudo = valor;
  if (typeof crudo === "string") {
    try {
      crudo = JSON.parse(crudo || "{}");
    } catch {
      crudo = {};
    }
  }
  const datos = crudo && typeof crudo === "object" && !Array.isArray(crudo)
    ? (crudo as Record<string, unknown>)
    : {};
  return {
    fotos: cantidad(datos.fotos, PANTALLA_DEFAULT.fotos),
    mensajes: cantidad(datos.mensajes, PANTALLA_DEFAULT.mensajes),
  };
}

export function pantallaConfig(evento: Pick<Evento, "pantalla_config">): PantallaConfig {
  return limpiar(evento.pantalla_config);
}

/** El panel puede mandar solo una de las dos cantidades: la otra se conserva. */
export function normalizarPantallaConfig(valor: unknown, actual: string): string {
  const previa = limpiar(actual);
  const nueva = valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
  return JSON.stringify({
    fotos: cantidad(nueva.fotos, previa.fotos),
    mensajes: cantidad(nueva.mensajes, previa.mensajes),
  });
}
