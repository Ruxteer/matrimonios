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
     tipo TEXT NOT NULL DEFAULT 'matrimonio',
     titulo TEXT NOT NULL DEFAULT '',
     descripcion TEXT NOT NULL DEFAULT '',
     registro_config TEXT NOT NULL DEFAULT '',
     fecha TEXT NOT NULL DEFAULT '',
     color_fondo TEXT NOT NULL DEFAULT '${COLORES.fondo}',
     color_rosa TEXT NOT NULL DEFAULT '${COLORES.rosa}',
     color_card TEXT NOT NULL DEFAULT '${COLORES.card}',
     color_texto TEXT NOT NULL DEFAULT '${COLORES.texto}',
     color_dorado TEXT NOT NULL DEFAULT '${COLORES.dorado}',
     banner TEXT NOT NULL DEFAULT '',
     banner_movil TEXT NOT NULL DEFAULT '',
     banner_texto INTEGER NOT NULL DEFAULT 1,
     mapa TEXT NOT NULL DEFAULT '',
     modulos TEXT NOT NULL DEFAULT '',
     pantalla_token TEXT NOT NULL DEFAULT '',
     clave TEXT NOT NULL DEFAULT '',
     cliente_id INTEGER NOT NULL DEFAULT 0,
     mapa_config TEXT NOT NULL DEFAULT '',
     pantalla_config TEXT NOT NULL DEFAULT '',
     textos TEXT NOT NULL DEFAULT '',
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  // Clientes: las agencias o marcas para las que se hacen eventos. Cada evento
  // cuelga de uno; cliente_id = 0 son los de Venito, que no tiene fila.
  `CREATE TABLE IF NOT EXISTS clientes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     slug TEXT UNIQUE NOT NULL,
     nombre TEXT NOT NULL,
     color TEXT NOT NULL DEFAULT '#5326b4',
     logo TEXT NOT NULL DEFAULT '',
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
     eliminado_at TEXT NOT NULL DEFAULT '',
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
     participante_id INTEGER,
     estado TEXT NOT NULL DEFAULT 'aprobada',
     created_at TEXT DEFAULT (datetime('now'))
   )`,

  // El registro del participante es independiente de las listas de invitados.
  // El token opaco vive solo en su cookie; la base guarda únicamente su hash.
  `CREATE TABLE IF NOT EXISTS participantes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL,
     nombre TEXT NOT NULL,
     email TEXT NOT NULL,
     email_normalizado TEXT NOT NULL,
     telefono TEXT NOT NULL DEFAULT '',
     consentimiento_legal INTEGER NOT NULL DEFAULT 0,
     consentimiento_informacion INTEGER NOT NULL DEFAULT 0,
     consentimiento_marketing INTEGER NOT NULL DEFAULT 0,
     campos_extra TEXT NOT NULL DEFAULT '{}',
     consentimientos_at TEXT NOT NULL DEFAULT '',
     consentimiento_version TEXT NOT NULL DEFAULT '',
     token_hash TEXT NOT NULL UNIQUE,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now')),
     UNIQUE (evento_id, email_normalizado)
   )`,
  `CREATE INDEX IF NOT EXISTS participantes_evento ON participantes (evento_id)`,

  // Agenda: las actividades del día, en el orden en que ocurren.
  `CREATE TABLE IF NOT EXISTS agenda (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     evento_id INTEGER NOT NULL,
     titulo TEXT NOT NULL,
     descripcion TEXT NOT NULL DEFAULT '',
     lugar TEXT NOT NULL DEFAULT '',
     hora TEXT NOT NULL DEFAULT '',
     dia TEXT NOT NULL DEFAULT '',
     imagen TEXT NOT NULL DEFAULT '',
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
     pide_datos INTEGER NOT NULL DEFAULT 0,
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
     nombre TEXT NOT NULL DEFAULT '',
     email TEXT NOT NULL DEFAULT '',
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
     cantidad_suplentes INTEGER NOT NULL DEFAULT 0,
     suplentes TEXT NOT NULL DEFAULT '',
     detalle TEXT NOT NULL DEFAULT '',
     disponibles INTEGER NOT NULL DEFAULT 0,
     base_nombre TEXT NOT NULL DEFAULT '',
     columnas TEXT NOT NULL DEFAULT '',
     columna_nombre TEXT NOT NULL DEFAULT '',
     columna_apellido TEXT NOT NULL DEFAULT '',
     columna_clave TEXT NOT NULL DEFAULT '',
     imagen TEXT NOT NULL DEFAULT '',
     fecha_sorteo TEXT NOT NULL DEFAULT '',
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  // Base de participantes importada desde Excel o CSV para un sorteo: cada fila
  // guarda todas sus columnas como JSON, porque cada organizador trae las suyas.
  `CREATE TABLE IF NOT EXISTS sorteo_participantes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     sorteo_id INTEGER NOT NULL,
     datos TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS sorteo_participantes_sorteo
     ON sorteo_participantes (sorteo_id)`,
  // Quienes se inscriben solos a un sorteo escaneando el QR de la pantalla.
  // El correo los distingue: una persona, una inscripción por sorteo.
  `CREATE TABLE IF NOT EXISTS sorteo_inscritos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     sorteo_id INTEGER NOT NULL,
     nombre TEXT NOT NULL,
     email TEXT NOT NULL,
     email_normalizado TEXT NOT NULL,
     created_at TEXT DEFAULT (datetime('now')),
     UNIQUE (sorteo_id, email_normalizado)
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
     imagenes TEXT NOT NULL DEFAULT '',
     multiple INTEGER NOT NULL DEFAULT 1,
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

  // Columnas que se fueron agregando después: las bases creadas antes las
  // reciben aquí, con su valor por defecto.
  const TEXTO = "TEXT NOT NULL DEFAULT ''";
  const NUMERO = "INTEGER NOT NULL DEFAULT 0";
  const faltantes: Record<string, Record<string, string>> = {
    eventos: {
      pantalla_token: TEXTO,
      modulos: TEXTO,
      clave: TEXTO,
      banner_movil: TEXTO,
      tipo: "TEXT NOT NULL DEFAULT 'matrimonio'",
      titulo: TEXTO,
      descripcion: TEXTO,
      registro_config: TEXTO,
      cliente_id: NUMERO,
      mapa_config: TEXTO,
      pantalla_config: TEXTO,
      textos: TEXTO,
    },
    guests: { eliminado_at: TEXTO },
    agenda: { imagen: TEXTO },
    votaciones: { pide_datos: NUMERO },
    votos: { nombre: TEXTO, email: TEXTO },
    // Las preguntas de antes se jugaban siempre marcando varias: quedan así.
    trivia_preguntas: { imagenes: TEXTO, multiple: "INTEGER NOT NULL DEFAULT 1" },
    photos: {
      participante_id: "INTEGER",
      estado: "TEXT NOT NULL DEFAULT 'aprobada'",
    },
    sorteos: {
      cantidad_suplentes: NUMERO,
      suplentes: TEXTO,
      detalle: TEXTO,
      disponibles: NUMERO,
      base_nombre: TEXTO,
      columnas: TEXTO,
      columna_nombre: TEXTO,
      columna_apellido: TEXTO,
      columna_clave: TEXTO,
      imagen: TEXTO,
      fecha_sorteo: TEXTO,
    },
  };
  for (const [tabla, campos] of Object.entries(faltantes)) {
    const existentes = await c.execute(`PRAGMA table_info(${tabla})`);
    for (const [nombre, tipo] of Object.entries(campos)) {
      if (!existentes.rows.some((f) => f.name === nombre)) {
        await c.execute(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo}`);
      }
    }
  }
  // Las bases anteriores reciben primero las columnas necesarias para estos índices.
  await c.execute("CREATE INDEX IF NOT EXISTS photos_evento_participante ON photos (evento_id, participante_id)");
  await c.execute("CREATE INDEX IF NOT EXISTS photos_evento_estado ON photos (evento_id, estado, id)");
  await c.execute("CREATE INDEX IF NOT EXISTS participantes_evento_id ON participantes (evento_id, id)");
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
  tipo: "matrimonio" | "activacion";
  titulo: string;
  descripcion: string;
  registro_config: string;
  fecha: string;
  color_fondo: string;
  color_rosa: string;
  color_card: string;
  color_texto: string;
  color_dorado: string;
  /** Banner para pantallas anchas; también se usa en el celular si no hay uno propio. */
  banner: string;
  /** Banner para celular. Vacío = se usa el de escritorio. */
  banner_movil: string;
  banner_texto: number;
  mapa: string;
  /** JSON con los módulos del matrimonio y su orden (ver lib/modulos.ts). */
  modulos: string;
  pantalla_token: string;
  /** Clave de los novios, guardada como "sal:hash". Vacía = solo entra la maestra. */
  clave: string;
  /** Cliente al que pertenece. 0 = Venito. */
  cliente_id: number;
  /** JSON con las zonas y la leyenda del mapa interactivo (ver lib/mapa.ts). */
  mapa_config: string;
  /** JSON con cuántas fotos y mensajes muestra a la vez la pantalla (ver lib/pantalla-config.ts). */
  pantalla_config: string;
  /** JSON con los títulos, textos y botones propios de cada módulo (ver lib/textos.ts). */
  textos: string;
  created_at: string;
};

export type Cliente = {
  id: number;
  slug: string;
  nombre: string;
  /** Color de su tarjeta en el panel (hex de 6 dígitos). */
  color: string;
  /** Logo subido (nombre de archivo o ruta de /public). */
  logo: string;
  created_at: string;
};

export type Foto = {
  id: number;
  evento_id: number;
  archivo: string;
  participante_id: number | null;
  estado: "pendiente" | "aprobada" | "rechazada";
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
  /** Foto opcional de la actividad. Vacía = la tarjeta se ve como siempre. */
  imagen: string;
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

export type TipoPregunta = "corta" | "parrafo" | "unica" | "multiple" | "escala" | "si_no" | "emoji";

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
  /** 1 = pide nombre y correo antes de votar; 0 = votación libre. */
  pide_datos: number;
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
  fuente: "invitados" | "mensajes" | "fotos" | "lista" | "base" | "inscritos";
  lista: string;
  cantidad: number;
  excluir_anteriores: number;
  publicado: number;
  /** JSON con los nombres que salieron. Es lo que se publica. */
  ganadores: string;
  ejecutado_at: string;
  /** Cuántos suplentes se sacan además de los ganadores. */
  cantidad_suplentes: number;
  /** JSON con los nombres de los suplentes, en el orden en que salieron. */
  suplentes: string;
  /**
   * JSON con ganadores y suplentes junto a todas sus columnas de la base. Solo
   * para el panel y el acta: puede traer correos o RUT, nunca se publica.
   */
  detalle: string;
  /** Entre cuántas personas salió el resultado. */
  disponibles: number;
  /** Nombre del archivo importado, para reconocerlo en el panel. */
  base_nombre: string;
  /** JSON con los encabezados de la base, en su orden. */
  columnas: string;
  columna_nombre: string;
  columna_apellido: string;
  /** Columna que distingue a cada persona (RUT, correo…). Vacía = el nombre. */
  columna_clave: string;
  /** Foto del premio, la imagen principal de la pantalla del sorteo. */
  imagen: string;
  /** Cuándo se sortea (ISO, UTC). Vacía = sin cuenta regresiva. */
  fecha_sorteo: string;
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
  /** JSON con la foto de cada alternativa, en el mismo orden ("" = sin foto). */
  imagenes: string;
  /** 1 = se pueden marcar varias; 0 = una sola. */
  multiple: number;
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
  /** Cuándo se eliminó. Vacío = sigue en la lista. */
  eliminado_at: string;
  created_at: string;
  updated_at: string;
};
