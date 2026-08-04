import { consultar } from "./db";
import type { Row } from "@libsql/client";

// Cuánto material carga la pantalla del salón. Es un carrusel, no un archivo:
// con las últimas cuarenta hay de sobra para toda la fiesta.
const MAXIMO = 40;

export type FotoPantalla = { id: number; archivo: string; created_at: string };
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
  const [fotos, mensajes, totales] = await Promise.all([
    consultar<Row>(
      "SELECT id, archivo, created_at FROM photos WHERE evento_id = ? ORDER BY id DESC LIMIT ?",
      [eventoId, MAXIMO]
    ),
    consultar<Row>(
      "SELECT id, nombre, mensaje, created_at FROM messages WHERE evento_id = ? ORDER BY id DESC LIMIT ?",
      [eventoId, MAXIMO]
    ),
    consultar<Row>(
      `SELECT (SELECT COUNT(*) FROM photos   WHERE evento_id = ?1) AS fotos,
              (SELECT COUNT(*) FROM messages WHERE evento_id = ?1) AS mensajes`,
      [eventoId]
    ),
  ]);
  return {
    fotos: fotos.map((f) => ({
      id: num(f.id),
      archivo: txt(f.archivo),
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
