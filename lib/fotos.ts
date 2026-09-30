import { consultar, ejecutar, uno } from "./db";

export type EstadoFoto = "pendiente" | "aprobada" | "rechazada";
export type FotoAdmin = {
  id: number;
  evento_id: number;
  participante_id: number | null;
  participante_nombre: string;
  participante_email: string;
  archivo: string;
  estado: EstadoFoto;
  created_at: string;
};

export function listarFotos(eventoId: number): Promise<FotoAdmin[]> {
  return consultar<FotoAdmin>(
    `SELECT f.*, COALESCE(p.nombre, '') AS participante_nombre,
            COALESCE(p.email, '') AS participante_email
       FROM photos f LEFT JOIN participantes p
         ON p.id = f.participante_id AND p.evento_id = f.evento_id
      WHERE f.evento_id = ? ORDER BY f.id DESC`,
    [eventoId]
  );
}

export async function contarFotos(eventoId: number, participanteId: number): Promise<number> {
  const fila = await uno<{ total: number }>(
    "SELECT COUNT(*) AS total FROM photos WHERE evento_id = ? AND participante_id = ?",
    [eventoId, participanteId]
  );
  return Number(fila?.total ?? 0);
}

// La condición y la inserción se ejecutan juntas: dos solicitudes simultáneas
// no pueden consumir el mismo último cupo. Todos los estados cuentan.
export function insertarFoto(
  eventoId: number,
  archivo: string,
  participanteId: number | null,
  estado: EstadoFoto,
  maximo: number
) {
  return ejecutar(
    `INSERT INTO photos (evento_id, archivo, participante_id, estado)
     SELECT ?1, ?2, ?3, ?4
      WHERE EXISTS (SELECT 1 FROM eventos WHERE id = ?1)
        AND (?3 IS NULL OR (
          EXISTS (SELECT 1 FROM participantes WHERE id = ?3 AND evento_id = ?1)
          AND (SELECT COUNT(*) FROM photos
                WHERE evento_id = ?1 AND participante_id = ?3) < ?5))`,
    [eventoId, archivo, participanteId, estado, maximo]
  );
}
