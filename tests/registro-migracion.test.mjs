import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@libsql/client");
const raiz = resolve(import.meta.dirname, "..");

test("una base anterior conserva sus datos y recibe columnas e índices de registro y fotos", async () => {
  const temporal = mkdtempSync(join(tmpdir(), "venito-migracion-"));
  mkdirSync(join(temporal, "data"));
  const cliente = createClient({ url: `file:${join(temporal, "data/matrimonio.db")}` });
  const directorioAnterior = process.cwd();
  const urlAnterior = process.env.TURSO_DATABASE_URL;
  const tokenAnterior = process.env.TURSO_AUTH_TOKEN;
  const extensionAnterior = require.extensions[".ts"];
  let baseActual;
  try {
    await cliente.batch([
      `CREATE TABLE eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL,
        nombre1 TEXT NOT NULL, nombre2 TEXT NOT NULL, fecha TEXT NOT NULL DEFAULT '',
        color_fondo TEXT NOT NULL DEFAULT '#fffdf9', color_rosa TEXT NOT NULL DEFAULT '#d78a9a',
        color_card TEXT NOT NULL DEFAULT '#ffffff', color_texto TEXT NOT NULL DEFAULT '#333333',
        color_dorado TEXT NOT NULL DEFAULT '#b69351', banner TEXT NOT NULL DEFAULT '',
        banner_texto INTEGER NOT NULL DEFAULT 1, mapa TEXT NOT NULL DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
      )`,
      "CREATE TABLE photos (id INTEGER PRIMARY KEY AUTOINCREMENT, evento_id INTEGER NOT NULL DEFAULT 1, archivo TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))",
      "INSERT INTO eventos (slug,nombre1,nombre2) VALUES ('boda-antigua','Camila','Juan')",
      "INSERT INTO photos (evento_id,archivo) VALUES (1,'foto-anterior.jpg')",
    ]);
    cliente.close();
    // Compila solo el módulo de la base y sus imports; no inicia Next ni carga .env.
    const ts = require("typescript");
    require.extensions[".ts"] = (module, filename) => {
      const output = ts.transpileModule(readFileSync(filename, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      }).outputText;
      module._compile(output, filename);
    };
    process.chdir(temporal);
    process.env.TURSO_DATABASE_URL = "";
    process.env.TURSO_AUTH_TOKEN = "";
    baseActual = await require(join(raiz, "lib/db.ts")).db();
    const evento = (await baseActual.execute("SELECT tipo,titulo,registro_config FROM eventos WHERE id = 1")).rows[0];
    const foto = (await baseActual.execute("SELECT participante_id,estado,archivo FROM photos WHERE id = 1")).rows[0];
    const indices = (await baseActual.execute("SELECT name FROM sqlite_master WHERE type = 'index'")).rows.map((r) => r.name);
    assert.deepEqual({ ...evento }, { tipo: "matrimonio", titulo: "", registro_config: "" });
    assert.deepEqual({ ...foto }, { participante_id: null, estado: "aprobada", archivo: "foto-anterior.jpg" });
    for (const nombre of ["photos_evento_participante", "photos_evento_estado", "participantes_evento_id"]) assert.ok(indices.includes(nombre));
  } finally {
    baseActual?.close();
    cliente.close();
    process.chdir(directorioAnterior);
    if (urlAnterior === undefined) delete process.env.TURSO_DATABASE_URL; else process.env.TURSO_DATABASE_URL = urlAnterior;
    if (tokenAnterior === undefined) delete process.env.TURSO_AUTH_TOKEN; else process.env.TURSO_AUTH_TOKEN = tokenAnterior;
    if (extensionAnterior) require.extensions[".ts"] = extensionAnterior; else delete require.extensions[".ts"];
    rmSync(temporal, { recursive: true, force: true });
  }
});
