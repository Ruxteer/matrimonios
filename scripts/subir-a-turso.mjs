// Copia la base local (data/matrimonio.db) a la base de Turso.
//
//   node scripts/subir-a-turso.mjs            copia si la base remota está vacía
//   node scripts/subir-a-turso.mjs --forzar   borra lo remoto y vuelve a copiar
//
// Lee TURSO_DATABASE_URL y TURSO_AUTH_TOKEN de .env.local o del entorno.
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const TABLAS = ["eventos", "guests", "messages", "photos"];

function variables() {
  const env = { ...process.env };
  const archivo = path.join(RAIZ, ".env.local");
  if (fs.existsSync(archivo)) {
    for (const linea of fs.readFileSync(archivo, "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = variables();
if (!env.TURSO_DATABASE_URL) {
  console.error("Falta TURSO_DATABASE_URL (ponla en .env.local).");
  process.exit(1);
}

const archivoLocal = path.join(RAIZ, "data", "matrimonio.db");
if (!fs.existsSync(archivoLocal)) {
  console.error(`No encontré la base local en ${archivoLocal}.`);
  process.exit(1);
}

const local = createClient({ url: `file:${archivoLocal}` });
const remoto = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});
const forzar = process.argv.includes("--forzar");

// El esquema se toma de la propia base local, así no se puede desincronizar.
const esquema = await local.execute(
  "SELECT sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL"
);
for (const fila of esquema.rows) await remoto.execute(fila.sql);

const yaHay = await remoto.execute("SELECT COUNT(*) AS n FROM guests");
if (Number(yaHay.rows[0].n) > 0 && !forzar) {
  console.error(
    `La base remota ya tiene ${yaHay.rows[0].n} invitados. ` +
      "Repite con --forzar si quieres reemplazarla."
  );
  process.exit(1);
}
if (forzar) {
  for (const tabla of [...TABLAS].reverse()) {
    await remoto.execute(`DELETE FROM ${tabla}`);
  }
}

for (const tabla of TABLAS) {
  const filas = (await local.execute(`SELECT * FROM ${tabla}`)).rows;
  if (!filas.length) {
    console.log(`${tabla}: sin datos`);
    continue;
  }
  const columnas = Object.keys(filas[0]);
  const huecos = columnas.map(() => "?").join(", ");
  const sql = `INSERT INTO ${tabla} (${columnas.join(", ")}) VALUES (${huecos})`;
  for (let i = 0; i < filas.length; i += 100) {
    const lote = filas.slice(i, i + 100).map((f) => ({
      sql,
      args: columnas.map((c) => f[c]),
    }));
    await remoto.batch(lote, "write");
  }
  console.log(`${tabla}: ${filas.length} filas copiadas`);
}

console.log("Listo.");
