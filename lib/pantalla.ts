import { consultar, uno, type Evento } from "./db";
import { moduloActivo } from "./modulos";
import { urlFotoPantalla } from "./urls";
import type { Row } from "@libsql/client";

// Cuánto material carga la pantalla del salón. Es un carrusel, no un archivo:
// con las últimas cuarenta hay de sobra para toda la fiesta.
const MAXIMO = 40;

export type FotoPantalla = { id: number; archivo: string; url: string; created_at: string };
export type MensajePantalla = {
  id: number;
  nombre: string;
  mensaje: string;
  created_at: string;
};

export type DatosPantalla = {
  fotos: FotoPantalla[];
  mensajes: MensajePantalla[];
  totales: { fotos: number; mensajes: number };
};

// Las filas que devuelve libSQL no son objetos planos, y esto viaja del
// servidor al navegador: hay que copiarlas campo por campo.
const num = (v: Row[string]) => Number(v ?? 0);
const txt = (v: Row[string]) => String(v ?? "");

// Lo más nuevo primero: así el carrusel parte siempre por la última foto que
// subió alguien, que es lo que la gente quiere ver.
export async function datosPantalla(eventoId: number): Promise<DatosPantalla> {
  const evento = await uno<Evento>("SELECT * FROM eventos WHERE id = ?", [eventoId]);
  if (!evento) return { fotos: [], mensajes: [], totales: { fotos: 0, mensajes: 0 } };
  const muestraFotos = moduloActivo(evento, "fotos");
  const muestraMensajes = moduloActivo(evento, "mensajes");
  const [fotos, mensajes, totales] = await Promise.all([
    muestraFotos ? consultar<Row>(
      "SELECT id, archivo, created_at FROM photos WHERE evento_id = ? AND estado = 'aprobada' ORDER BY id DESC LIMIT ?",
      [eventoId, MAXIMO]
    ) : Promise.resolve([]),
    muestraMensajes ? consultar<Row>(
      "SELECT id, nombre, mensaje, created_at FROM messages WHERE evento_id = ? ORDER BY id DESC LIMIT ?",
      [eventoId, MAXIMO]
    ) : Promise.resolve([]),
    consultar<Row>(
      `SELECT (SELECT COUNT(*) FROM photos WHERE evento_id = ?1 AND estado = 'aprobada' AND ?2 = 1) AS fotos,
              (SELECT COUNT(*) FROM messages WHERE evento_id = ?1 AND ?3 = 1) AS mensajes`,
      [eventoId, muestraFotos ? 1 : 0, muestraMensajes ? 1 : 0]
    ),
  ]);
  return {
    fotos: fotos.map((f) => ({
      id: num(f.id),
      archivo: txt(f.archivo),
      url: urlFotoPantalla(txt(f.archivo), evento.slug, evento.pantalla_token),
      created_at: txt(f.created_at),
    })),
    mensajes: mensajes.map((m) => ({
      id: num(m.id),
      nombre: txt(m.nombre),
      mensaje: txt(m.mensaje),
      created_at: txt(m.created_at),
    })),
    totales: {
      fotos: num(totales[0]?.fotos),
      mensajes: num(totales[0]?.mensajes),
    },
  };
}
