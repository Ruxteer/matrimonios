import { consultar, uno, type OpcionVotacion, type Votacion } from "./db";
import { urlArchivo } from "./urls";

// Lo que necesita la pantalla en vivo de una votación: las alternativas con su
// foto y sus votos, aunque la votación no le muestre resultados a quien vota
// (proyectarla es decisión del organizador).
export type OpcionPantalla = { id: number; texto: string; imagen: string; votos: number };
export type VotacionPantalla = {
  id: number;
  titulo: string;
  descripcion: string;
  abierta: boolean;
  multiple: boolean;
  pide_datos: boolean;
  opciones: OpcionPantalla[];
  total: number;
  /** Personas (teléfonos o correos) que votaron, no votos marcados. */
  votantes: number;
};

export async function votacionParaPantalla(
  eventoId: number,
  id: number
): Promise<VotacionPantalla | null> {
  const votacion = await uno<Votacion>(
    "SELECT * FROM votaciones WHERE id = ? AND evento_id = ?",
    [id, eventoId]
  );
  if (!votacion) return null;
  const opciones = await consultar<OpcionVotacion & { votos: number }>(
    `SELECT o.*, (SELECT COUNT(*) FROM votos v WHERE v.opcion_id = o.id) AS votos
       FROM votacion_opciones o WHERE o.votacion_id = ? ORDER BY o.orden, o.id`,
    [votacion.id]
  );
  const personas = await uno<{ total: number }>(
    `SELECT COUNT(DISTINCT CASE WHEN email <> '' THEN 'e:' || email
                                 WHEN sesion <> '' THEN 's:' || sesion
                                 ELSE 'v:' || id END) AS total
       FROM votos WHERE votacion_id = ?`,
    [votacion.id]
  );
  // Las filas de libSQL no son objetos planos: se copian campo por campo.
  const lista = opciones.map((o) => ({
    id: Number(o.id),
    texto: String(o.texto),
    imagen: urlArchivo(String(o.imagen ?? "")),
    votos: Number(o.votos),
  }));
  return {
    id: Number(votacion.id),
    titulo: String(votacion.titulo),
    descripcion: String(votacion.descripcion),
    abierta: Boolean(votacion.abierta),
    multiple: Boolean(votacion.multiple),
    pide_datos: Boolean(votacion.pide_datos),
    opciones: lista,
    total: lista.reduce((n, o) => n + o.votos, 0),
    votantes: Number(personas?.total ?? 0),
  };
}
