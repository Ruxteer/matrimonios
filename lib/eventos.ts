import crypto from "crypto";
import type { NextRequest } from "next/server";
import { consultar, ejecutar, newToken, uno, Evento } from "./db";
import { esAdminDeEvento, eventoDeLaSesion, guardarClave } from "./auth";
import { COLORES } from "./config";
import { borrarArchivo } from "./archivos";
import { normalizarModulos } from "./modulos";

// Los colores se inyectan como CSS: solo se aceptan hex de 6 dígitos.
export { colorValido } from "./colores";
import { colorValido } from "./colores";

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function listarEventos(): Promise<Evento[]> {
  return consultar<Evento>("SELECT * FROM eventos ORDER BY created_at DESC");
}

export function getEvento(slug: string): Promise<Evento | null> {
  return uno<Evento>("SELECT * FROM eventos WHERE slug = ? COLLATE NOCASE", [slug]);
}

export async function slugDisponible(base: string, exceptoId?: number): Promise<string> {
  const raiz = base || "matrimonio";
  let slug = raiz;
  let n = 2;
  for (;;) {
    const existe = await uno<{ id: number }>(
      "SELECT id FROM eventos WHERE slug = ? COLLATE NOCASE",
      [slug]
    );
    if (!existe || existe.id === exceptoId) return slug;
    slug = `${raiz}-${n++}`;
  }
}

export async function crearEvento(datos: {
  nombre1: string;
  nombre2: string;
  fecha?: string;
  slug?: string;
}): Promise<Evento> {
  const nombre1 = datos.nombre1.trim();
  const nombre2 = datos.nombre2.trim();
  const slug = await slugDisponible(slugify(datos.slug || `${nombre1}-y-${nombre2}`));
  const res = await ejecutar(
    `INSERT INTO eventos (slug, nombre1, nombre2, fecha, color_fondo, color_rosa,
                          color_card, color_texto, color_dorado, pantalla_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      nombre1,
      nombre2,
      (datos.fecha ?? "").trim(),
      COLORES.fondo,
      COLORES.rosa,
      COLORES.card,
      COLORES.texto,
      COLORES.dorado,
      newToken(),
    ]
  );
  return (await uno<Evento>("SELECT * FROM eventos WHERE id = ?", [
    Number(res.lastInsertRowid),
  ]))!;
}

const CAMPOS_TEXTO = [
  "nombre1",
  "nombre2",
  "fecha",
  "banner",
  "banner_movil",
  "mapa",
] as const;

// Los campos que guardan una imagen subida: al reemplazarla o quitarla, el
// archivo anterior deja de servir y se borra del almacenamiento.
const CAMPOS_IMAGEN = ["banner", "banner_movil", "mapa"] as const;
const CAMPOS_COLOR = [
  "color_fondo",
  "color_rosa",
  "color_card",
  "color_texto",
  "color_dorado",
] as const;

export async function actualizarEvento(
  evento: Evento,
  body: Record<string, unknown>
): Promise<Evento> {
  const sets: string[] = [];
  const valores: (string | number)[] = [];

  for (const campo of CAMPOS_TEXTO) {
    if (campo in body) {
      sets.push(`${campo} = ?`);
      valores.push(String(body[campo] ?? "").trim());
    }
  }
  for (const campo of CAMPOS_COLOR) {
    if (campo in body && colorValido(body[campo])) {
      sets.push(`${campo} = ?`);
      valores.push(body[campo] as string);
    }
  }
  if ("banner_texto" in body) {
    sets.push("banner_texto = ?");
    valores.push(body.banner_texto ? 1 : 0);
  }
  if ("modulos" in body) {
    const modulos = normalizarModulos(body.modulos);
    if (modulos) {
      sets.push("modulos = ?");
      valores.push(modulos);
    }
  }
  if ("slug" in body) {
    sets.push("slug = ?");
    valores.push(await slugDisponible(slugify(String(body.slug)), evento.id));
  }
  if (sets.length) {
    await ejecutar(`UPDATE eventos SET ${sets.join(", ")} WHERE id = ?`, [
      ...valores,
      evento.id,
    ]);
  }
  const actualizado = (await uno<Evento>("SELECT * FROM eventos WHERE id = ?", [
    evento.id,
  ]))!;

  // Una imagen reemplazada queda huérfana en el almacenamiento. Solo se borra
  // si ya no la usa ningún otro campo del matrimonio.
  const enUso = new Set(CAMPOS_IMAGEN.map((campo) => actualizado[campo]));
  for (const campo of CAMPOS_IMAGEN) {
    const anterior = evento[campo];
    if (anterior && !enUso.has(anterior)) await borrarArchivo(anterior);
  }
  return actualizado;
}

// Tablas que cuelgan de otra tabla y no del matrimonio: para borrarlas hay que
// pasar por su padre.
const HIJAS: [hija: string, campo: string, padre: string][] = [
  ["encuesta_preguntas", "encuesta_id", "encuestas"],
  ["encuesta_respuestas", "encuesta_id", "encuestas"],
  ["votacion_opciones", "votacion_id", "votaciones"],
  ["votos", "votacion_id", "votaciones"],
  ["trivia_preguntas", "trivia_id", "trivias"],
  ["trivia_partidas", "trivia_id", "trivias"],
  ["sorteo_participantes", "sorteo_id", "sorteos"],
];

const POR_EVENTO = [
  "guests",
  "messages",
  "photos",
  "agenda",
  "encuestas",
  "votaciones",
  "sorteos",
  "trivias",
];

export async function eliminarEvento(evento: Evento) {
  const fotos = await consultar<{ archivo: string }>(
    "SELECT archivo FROM photos WHERE evento_id = ?",
    [evento.id]
  );
  const imagenes = await consultar<{ imagen: string }>(
    `SELECT imagen FROM votacion_opciones
      WHERE imagen <> '' AND votacion_id IN (SELECT id FROM votaciones WHERE evento_id = ?)`,
    [evento.id]
  );

  await ejecutar(
    `DELETE FROM encuesta_valores WHERE respuesta_id IN (
       SELECT id FROM encuesta_respuestas WHERE encuesta_id IN
         (SELECT id FROM encuestas WHERE evento_id = ?))`,
    [evento.id]
  );
  for (const [hija, campo, padre] of HIJAS) {
    await ejecutar(
      `DELETE FROM ${hija} WHERE ${campo} IN (SELECT id FROM ${padre} WHERE evento_id = ?)`,
      [evento.id]
    );
  }
  for (const tabla of POR_EVENTO) {
    await ejecutar(`DELETE FROM ${tabla} WHERE evento_id = ?`, [evento.id]);
  }
  await ejecutar("DELETE FROM eventos WHERE id = ?", [evento.id]);

  // Las imágenes del matrimonio dejan de estar referenciadas.
  for (const archivo of [
    ...fotos.map((f) => f.archivo),
    ...imagenes.map((i) => i.imagen),
    evento.banner,
    evento.banner_movil,
    evento.mapa,
  ]) {
    await borrarArchivo(archivo);
  }
}

// La pantalla del salón se abre con una clave propia en la dirección, para no
// tener que escribir la contraseña del panel en el notebook del lugar.
export async function regenerarTokenPantalla(evento: Evento): Promise<Evento> {
  await ejecutar("UPDATE eventos SET pantalla_token = ? WHERE id = ?", [
    newToken(),
    evento.id,
  ]);
  return (await uno<Evento>("SELECT * FROM eventos WHERE id = ?", [evento.id]))!;
}

export function tokenPantallaValido(evento: Evento, intento: string): boolean {
  const guardado = evento.pantalla_token ?? "";
  if (!guardado) return false;
  const hash = (s: string) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(hash(intento), hash(guardado));
}

// Todo lo que se le entrega al navegador de un invitado pasa por aquí: el id
// interno, la clave de la pantalla y la de los novios no salen del servidor.
export function eventoPublico(evento: Evento) {
  const { id, pantalla_token, clave, ...publico } = evento;
  void id;
  void pantalla_token;
  void clave;
  return publico;
}

// Para las rutas que no llevan el matrimonio en la dirección (subir una imagen,
// bajar la planilla): reconoce de qué matrimonio viene la sesión y comprueba
// que la cookie sea suya de verdad, no solo que traiga un número.
export async function eventoDeSesion(req: NextRequest): Promise<Evento | null> {
  const id = eventoDeLaSesion(req);
  if (!id) return null;
  const evento = await uno<Evento>("SELECT * FROM eventos WHERE id = ?", [id]);
  return evento && esAdminDeEvento(req, evento) ? evento : null;
}

/**
 * El matrimonio tal como lo ve el panel: sin el hash de la clave de los novios,
 * solo si está puesta. `maestra` dice si quien mira entró con la clave de
 * administración, para esconder lo que los novios no pueden hacer.
 */
export type EventoPanel = Omit<Evento, "clave"> & {
  tiene_clave: boolean;
  maestra?: boolean;
};

// Lo que ve el panel: necesita el id y la clave de la pantalla, pero de la
// clave de los novios solo si está puesta o no. El hash no sale de aquí.
export function eventoParaPanel(evento: Evento): EventoPanel {
  const { clave, ...resto } = evento;
  return { ...resto, tiene_clave: Boolean(clave) };
}

// Guarda la clave de los novios ya convertida en hash, o la borra con "".
export async function definirClaveEvento(
  evento: Evento,
  clave: string
): Promise<EventoPanel | null> {
  let guardar = "";
  if (clave.trim()) {
    const preparada = guardarClave(clave);
    if (!preparada) return null;
    guardar = preparada;
  }
  await ejecutar("UPDATE eventos SET clave = ? WHERE id = ?", [guardar, evento.id]);
  return eventoParaPanel(
    (await uno<Evento>("SELECT * FROM eventos WHERE id = ?", [evento.id]))!
  );
}

export async function resumenEvento(id: number) {
  const fila = await uno<{
    invitados: number;
    mesas: number;
    mensajes: number;
    fotos: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM guests   WHERE evento_id = ?1) AS invitados,
       (SELECT COUNT(DISTINCT mesa) FROM guests WHERE evento_id = ?1 AND mesa <> '') AS mesas,
       (SELECT COUNT(*) FROM messages WHERE evento_id = ?1) AS mensajes,
       (SELECT COUNT(*) FROM photos   WHERE evento_id = ?1) AS fotos`,
    [id]
  );
  return fila ?? { invitados: 0, mesas: 0, mensajes: 0, fotos: 0 };
}

export function nombreEvento(e: Evento): string {
  return `${e.nombre1} y ${e.nombre2}`;
}
