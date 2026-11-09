import { archivoSubido } from "./urls";
import type { PreguntaTrivia } from "./db";

// Lectura de las alternativas de una pregunta de trivia. Cada alternativa tiene
// texto, foto o las dos: se guardan como dos listas del mismo largo.
// Sin dependencias del servidor: lo usan el panel, el sitio y las rutas.

function lista(json: string): unknown[] {
  try {
    const valor = JSON.parse(json || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

export function alternativasDe(json: string): string[] {
  return lista(json).map((v) => String(v ?? ""));
}

/** La foto de cada alternativa, alineada con las alternativas ("" = sin foto). */
export function imagenesPorAlternativa(json: string, cantidad: number): string[] {
  const fotos = lista(json).map(archivoSubido);
  return Array.from({ length: cantidad }, (_, i) => fotos[i] ?? "");
}

/** Solo las fotos que existen, para borrarlas del almacenamiento. */
export function imagenesDeTrivia(json: string): string[] {
  return lista(json).map(archivoSubido).filter(Boolean);
}

export function correctasDe(json: string): number[] {
  return [...new Set(lista(json).map(Number).filter(Number.isInteger))];
}

/** Una pregunta como la ve quien juega: sin las correctas ni la explicación. */
export function preguntaPublica(p: PreguntaTrivia) {
  const opciones = alternativasDe(p.opciones);
  return {
    id: Number(p.id),
    enunciado: String(p.enunciado),
    opciones,
    imagenes: imagenesPorAlternativa(p.imagenes, opciones.length),
    multiple: Boolean(p.multiple),
  };
}

/** Una pregunta como la edita el panel. */
export function preguntaPanel(p: PreguntaTrivia) {
  return {
    ...preguntaPublica(p),
    correctas: correctasDe(p.correctas),
    explicacion: String(p.explicacion),
  };
}
