import type { Evento } from "./db";

export function etiquetaEvento(evento: Pick<Evento, "tipo" | "titulo" | "nombre1" | "nombre2">): string {
  return evento.tipo === "activacion"
    ? evento.titulo || evento.nombre1
    : `${evento.nombre1} y ${evento.nombre2}`;
}
