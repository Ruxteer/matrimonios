import { createClient, type Client, type InArgs } from "@libsql/client";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { COLORES } from "./config";

// En producción se usa Turso (SQLite alojado, TURSO_DATABASE_URL). Sin esa
// variable cae a un archivo local, que es lo cómodo para desarrollar.
function crearCliente(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  const carpeta = path.join(process.cwd(), "data");
  fs.mkdirSync(carpeta, { recursive: true });
  return createClient({ url: `file:${path.join(carpeta, "matrimonio.db")}` });
}

let cliente: Client | null = null;
let preparada: Promise<void> | null = null;

export async function db(): Promise<Client> {
  if (!cliente) cliente = crearCliente();
  if (!preparada) preparada = preparar(cliente);
  await preparada;
  return cliente;
}

export async function consultar<T>(sql: string, args?: InArgs): Promise<T[]> {
  const c = await db();
  const r = await c.execute(args === undefined ? sql : { sql, args });
  return r.rows as unknown as T[];
}

export async function uno<T>(sql: string, args?: InArgs): Promise<T | null> {
  const filas = await consultar<T>(sql, args);
  return filas[0] ?? null;
}

export async function ejecutar(sql: string, args?: InArgs) {
  const c = await db();
  return c.execute(args === undefined ? sql : { sql, args });
}

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS eventos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     slug TEXT UNIQUE NOT NULL,
     nombre1 TEXT NOT NULL,
     nombre2 TEXT NOT NULL,
     fecha TEXT NOT NULL DEFAULT '',
     color_fondo TEXT NOT NULL DEFAULT '${COLORES.fondo}',
     color_rosa TEXT NOT NULL DEFAULT '${COLORES.rosa}',
     color_card TEXT NOT NULL DEFAULT '${COLORES.card}',
     color_texto TEXT NOT NULL DEFAULT '${COLORES.texto}',
     color_dorado TEXT NOT NULL DEFAULT '${COLORES.dorado}',
     banner TEXT NOT NULL DEFAULT '',
     banner_texto INTEGER NOT NULL DEFAULT 1,
     mapa TEXT NOT NULL DEFAULT '',
     modulos TEXT NOT NULL DEFAULT '',
     pantalla_token TEXT NOT NULL DEFAULT '',
     clave TEXT NOT NULL DEFAULT '',
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS guests (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL DEFAULT 1,
     nombre TEXT NOT NULL,
     telefono TEXT DEFAULT '',
     email TEXT DEFAULT '',
     grupo TEXT DEFAULT '',
     mesa TEXT DEFAULT '',
     cupos INTEGER DEFAULT 1,
     estado TEXT DEFAULT 'pendiente',
     asistentes INTEGER DEFAULT 0,
     nota TEXT DEFAULT '',
     token TEXT UNIQUE NOT NULL,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL DEFAULT 1,
     nombre TEXT NOT NULL,
     mensaje TEXT NOT NULL,
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS photos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL DEFAULT 1,
     archivo TEXT NOT NULL,
     created_at TEXT DEFAULT (datetime('now'))
   )`,

  // Agenda: las actividades del día, en el orden en que ocurren.
  `CREATE TABLE IF NOT EXISTS agenda (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL,
     titulo TEXT NOT NULL,
     descripcion TEXT NOT NULL DEFAULT '',
     lugar TEXT NOT NULL DEFAULT '',
     hora TEXT NOT NULL DEFAULT '',
     dia TEXT NOT NULL DEFAULT '',
     orden INTEGER NOT NULL DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now'))
   )`,

  // Encuestas: una encuesta tiene preguntas; cada invitado que responde deja
  // una fila en encuesta_respuestas y un valor por pregunta contestada.
  `CREATE TABLE IF NOT EXISTS encuestas (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL,
     titulo TEXT NOT NULL,
     descripcion TEXT NOT NULL DEFAULT '',
     mensaje_final TEXT NOT NULL DEFAULT '',
     pide_nombre INTEGER NOT NULL DEFAULT 0,
     abierta INTEGER NOT NULL DEFAULT 1,
     orden INTEGER NOT NULL DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS encuesta_preguntas (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     encuesta_id INTEGER NOT NULL,
     texto TEXT NOT NULL,
     tipo TEXT NOT NULL DEFAULT 'corta',
     opciones TEXT NOT NULL DEFAULT '',
     obligatoria INTEGER NOT NULL DEFAULT 0,
     orden INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS encuesta_respuestas (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     encuesta_id INTEGER NOT NULL,
     participante TEXT NOT NULL DEFAULT '',
     sesion TEXT NOT NULL DEFAULT '',
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS encuesta_valores (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     respuesta_id INTEGER NOT NULL,
     pregunta_id INTEGER NOT NULL,
     valor TEXT NOT NULL DEFAULT ''
   )`,

  // Votaciones: alternativas y un voto por opción elegida.
  `CREATE TABLE IF NOT EXISTS votaciones (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL,
     titulo TEXT NOT NULL,
     descripcion TEXT NOT NULL DEFAULT '',
     multiple INTEGER NOT NULL DEFAULT 0,
     resultados TEXT NOT NULL DEFAULT 'siempre',
     abierta INTEGER NOT NULL DEFAULT 1,
     orden INTEGER NOT NULL DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS votacion_opciones (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     votacion_id INTEGER NOT NULL,
     texto TEXT NOT NULL,
     imagen TEXT NOT NULL DEFAULT '',
     orden INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS votos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     votacion_id INTEGER NOT NULL,
     opcion_id INTEGER NOT NULL,
     sesion TEXT NOT NULL DEFAULT '',
     created_at TEXT DEFAULT (datetime('now'))
   )`,

  // Sorteos: la lista de ganadores queda guardada como evidencia de lo que
  // salió, con la hora en que se ejecutó.
  `CREATE TABLE IF NOT EXISTS sorteos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL,
     titulo TEXT NOT NULL,
     premio TEXT NOT NULL DEFAULT '',
     fuente TEXT NOT NULL DEFAULT 'invitados',
     lista TEXT NOT NULL DEFAULT '',
     cantidad INTEGER NOT NULL DEFAULT 1,
     excluir_anteriores INTEGER NOT NULL DEFAULT 1,
     publicado INTEGER NOT NULL DEFAULT 1,
     ganadores TEXT NOT NULL DEFAULT '',
     ejecutado_at TEXT NOT NULL DEFAULT '',
     created_at TEXT DEFAULT (datetime('now'))
   )`,

  // Trivia: preguntas con alternativas y el puntaje de cada partida jugada.
  `CREATE TABLE IF NOT EXISTS trivias (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL,
     titulo TEXT NOT NULL,
     descripcion TEXT NOT NULL DEFAULT '',
     abierta INTEGER NOT NULL DEFAULT 1,
     orden INTEGER NOT NULL DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS trivia_preguntas (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     trivia_id INTEGER NOT NULL,
     enunciado TEXT NOT NULL,
     opciones TEXT NOT NULL DEFAULT '',
     correctas TEXT NOT NULL DEFAULT '',
     explicacion TEXT NOT NULL DEFAULT '',
     orden INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS trivia_partidas (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     trivia_id INTEGER NOT NULL,
     participante TEXT NOT NULL DEFAULT '',
     puntaje INTEGER NOT NULL DEFAULT 0,
     total INTEGER NOT NULL DEFAULT 0,
     sesion TEXT NOT NULL DEFAULT '',
     created_at TEXT DEFAULT (datetime('now'))
   )`,
];

// Se ejecuta una vez por instancia: crea el esquema si falta y completa las
// bases hechas con la versión de un solo matrimonio.
async function preparar(c: Client) {
  for (const sql of ESQUEMA) await c.execute(sql);

  for (const tabla of ["guests", "messages", "photos"]) {
    const cols = await c.execute(`PRAGMA table_info(${tabla})`);
    if (!cols.rows.some((f) => f.name === "evento_id")) {
      await c.execute(
        `ALTER TABLE ${tabla} ADD COLUMN evento_id INTEGER NOT NULL DEFAULT 1`
      );
    }
  }

  const columnas = await c.execute("PRAGMA table_info(eventos)");
  const faltantes: Record<string, string> = {
    pantalla_token: "TEXT NOT NULL DEFAULT ''",
    modulos: "TEXT NOT NULL DEFAULT ''",
    clave: "TEXT NOT NULL DEFAULT ''",
  };
  for (const [nombre, tipo] of Object.entries(faltantes)) {
    if (!columnas.rows.some((f) => f.name === nombre)) {
      await c.execute(`ALTER TABLE eventos ADD COLUMN ${nombre} ${tipo}`);
    }
  }
  // Cada matrimonio necesita su propia clave de pantalla, así que se completan
  // de a uno los que vengan de una versión anterior.
  const sinToken = await c.execute("SELECT id FROM eventos WHERE pantalla_token = ''");
  for (const fila of sinToken.rows) {
    await c.execute({
      sql: "UPDATE eventos SET pantalla_token = ? WHERE id = ?",
      args: [newToken(), Number(fila.id)],
    });
  }

  const eventos = await c.execute("SELECT COUNT(*) AS total FROM eventos");
  const invitados = await c.execute("SELECT COUNT(*) AS total FROM guests");
  if (Number(eventos.rows[0].total) === 0 && Number(invitados.rows[0].total) > 0) {
    await c.execute(
      `INSERT INTO eventos (id, slug, nombre1, nombre2, fecha, mapa)
       VALUES (1, 'camila-y-juan', 'Camila', 'Juan', '20 · 10 · 2026', '/design/mapa.webp')`
    );
  }
}

export function newToken(): string {
  return crypto.randomBytes(8).toString("hex");
}

export type Evento = {
  id: number;
  slug: string;
  nombre1: string;
  nombre2: string;
  fecha: string;
  color_fondo: string;
  color_rosa: string;
  color_card: string;
  color_texto: string;
  color_dorado: string;
  banner: string;
  banner_texto: number;
  mapa: string;
  /** JSON con los módulos del matrimonio y su orden (ver lib/modulos.ts). */
  modulos: string;
  pantalla_token: string;
  /** Clave de los novios, guardada como "sal:hash". Vacía = solo entra la maestra. */
  clave: string;
  created_at: string;
};

export type Actividad = {
  id: number;
  evento_id: number;
  titulo: string;
  descripcion: string;
  lugar: string;
  hora: string;
  dia: string;
  orden: number;
  created_at: string;
};

export type Encuesta = {
  id: number;
  evento_id: number;
  titulo: string;
  descripcion: string;
  mensaje_final: string;
  pide_nombre: number;
  abierta: number;
  orden: number;
  created_at: string;
};

export type TipoPregunta = "corta" | "parrafo" | "unica" | "multiple" | "escala" | "si_no";

export type PreguntaEncuesta = {
  id: number;
  encuesta_id: number;
  texto: string;
  tipo: TipoPregunta;
  /** JSON con las alternativas cuando el tipo las necesita. */
  opciones: string;
  obligatoria: number;
  orden: number;
};

export type Votacion = {
  id: number;
  evento_id: number;
  titulo: string;
  descripcion: string;
  multiple: number;
  resultados: "siempre" | "al_cerrar" | "nunca";
  abierta: number;
  orden: number;
  created_at: string;
};

export type OpcionVotacion = {
  id: number;
  votacion_id: number;
  texto: string;
  imagen: string;
  orden: number;
};

export type Sorteo = {
  id: number;
  evento_id: number;
  titulo: string;
  premio: string;
  fuente: "invitados" | "mensajes" | "fotos" | "lista";
  lista: string;
  cantidad: number;
  excluir_anteriores: number;
  publicado: number;
  /** JSON con los nombres que salieron. */
  ganadores: string;
  ejecutado_at: string;
  created_at: string;
};

export type Trivia = {
  id: number;
  evento_id: number;
  titulo: string;
  descripcion: string;
  abierta: number;
  orden: number;
  created_at: string;
};

export type PreguntaTrivia = {
  id: number;
  trivia_id: number;
  enunciado: string;
  /** JSON con las alternativas. */
  opciones: string;
  /** JSON con los índices correctos. */
  correctas: string;
  explicacion: string;
  orden: number;
};

export type Guest = {
  id: number;
  evento_id: number;
  nombre: string;
  telefono: string;
  email: string;
  grupo: string;
  mesa: string;
  cupos: number;
  estado: "pendiente" | "confirmado" | "rechazado";
  asistentes: number;
  nota: string;
  token: string;
  created_at: string;
  updated_at: string;
};
