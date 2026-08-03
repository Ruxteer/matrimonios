import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { COLORES } from "./config";

const dbPath = path.join(process.cwd(), "data", "matrimonio.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS eventos (
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
    );
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL DEFAULT 1,
      nombre TEXT NOT NULL,
      telefono TEXT DEFAULT '',
      email TEXT DEFAULT '',
      grupo TEXT DEFAULT '',
      mesa TEXT DEFAULT '',
      cupos INTEGER DEFAULT 1,
      estado TEXT DEFAULT 'pendiente', -- pendiente | confirmado | rechazado
      asistentes INTEGER DEFAULT 0,    -- cuántos confirmó finalmente
      nota TEXT DEFAULT '',
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL DEFAULT 1,
      nombre TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL DEFAULT 1,
      archivo TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  migrar(_db);
  return _db;
}

// Las bases creadas con la versión de un solo matrimonio no traen evento_id ni
// tabla de eventos: se completan aquí y lo que ya existía queda en el evento 1.
function migrar(d: Database.Database) {
  for (const tabla of ["guests", "messages", "photos"]) {
    const cols = d.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === "evento_id")) {
      d.exec(`ALTER TABLE ${tabla} ADD COLUMN evento_id INTEGER NOT NULL DEFAULT 1`);
    }
  }
  const { eventos } = d.prepare("SELECT COUNT(*) AS eventos FROM eventos").get() as {
    eventos: number;
  };
  const { invitados } = d.prepare("SELECT COUNT(*) AS invitados FROM guests").get() as {
    invitados: number;
  };
  if (eventos === 0 && invitados > 0) {
    d.prepare(
      `INSERT INTO eventos (id, slug, nombre1, nombre2, fecha, mapa)
       VALUES (1, 'camila-y-juan', 'Camila', 'Juan', '20 · 10 · 2026', '/design/mapa.webp')`
    ).run();
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
