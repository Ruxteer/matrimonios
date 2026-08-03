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
  created_at: string;
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
