// Lo que comparten el panel, el sitio y la API sobre las preguntas de encuesta.

/** Las caritas que trae una pregunta de emojis nueva, de la mejor a la peor. */
export const EMOJIS_PREDETERMINADOS = ["😍", "😄", "🙂", "😐", "😢"];
export const MAXIMO_EMOJIS = 5;

/**
 * Deja solo emojis de verdad: sin letras ni números y sin repetir. Un emoji
 * puede ser de varios caracteres (tonos de piel, banderas), por eso el largo
 * máximo no es 1.
 */
export function limpiarEmojis(lista: unknown[]): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const item of lista) {
    const e = String(item ?? "").trim().slice(0, 16);
    if (!e || vistos.has(e) || /[\p{L}\p{N}]/u.test(e.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, ""))) continue;
    if (!/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u.test(e)) continue;
    vistos.add(e);
    salida.push(e);
    if (salida.length === MAXIMO_EMOJIS) break;
  }
  return salida;
}
