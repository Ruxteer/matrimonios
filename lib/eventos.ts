import fs from "fs";
import path from "path";
import { db, Evento } from "./db";
import { COLORES } from "./config";
import { CARPETA, NOMBRE_VALIDO } from "./archivos";

const HEX = /^#[0-9a-fA-F]{6}$/;

// Los colores se inyectan como CSS: solo se aceptan hex de 6 dígitos.
export function colorValido(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function listarEventos(): Evento[] {
  return db().prepare("SELECT * FROM eventos ORDER BY created_at DESC").all() as Evento[];
}

export function getEvento(slug: string): Evento | null {
  return (db()
    .prepare("SELECT * FROM eventos WHERE slug = ? COLLATE NOCASE")
    .get(slug) ?? null) as Evento | null;
}

export function slugDisponible(base: string, exceptoId?: number): string {
  let slug = base || "matrimonio";
  let n = 2;
  for (;;) {
    const existe = db()
      .prepare("SELECT id FROM eventos WHERE slug = ? COLLATE NOCASE")
      .get(slug) as { id: number } | undefined;
    if (!existe || existe.id === exceptoId) return slug;
    slug = `${base}-${n++}`;
  }
}

export function crearEvento(datos: {
  nombre1: string;
  nombre2: string;
  fecha?: string;
  slug?: string;
}): Evento {
  const nombre1 = datos.nombre1.trim();
  const nombre2 = datos.nombre2.trim();
  const slug = slugDisponible(
    slugify(datos.slug || `${nombre1}-y-${nombre2}`)
  );
  const res = db()
    .prepare(
      `INSERT INTO eventos (slug, nombre1, nombre2, fecha, color_fondo, color_rosa,
                            color_card, color_texto, color_dorado)
       VALUES (@slug, @nombre1, @nombre2, @fecha, @fondo, @rosa, @card, @texto, @dorado)`
    )
    .run({
      slug,
      nombre1,
      nombre2,
      fecha: (datos.fecha ?? "").trim(),
      fondo: COLORES.fondo,
      rosa: COLORES.rosa,
      card: COLORES.card,
      texto: COLORES.texto,
      dorado: COLORES.dorado,
    });
  return db()
    .prepare("SELECT * FROM eventos WHERE id = ?")
    .get(res.lastInsertRowid) as Evento;
}

const CAMPOS_TEXTO = ["nombre1", "nombre2", "fecha", "banner", "mapa"] as const;
const CAMPOS_COLOR = [
  "color_fondo",
  "color_rosa",
  "color_card",
  "color_texto",
  "color_dorado",
] as const;

export function actualizarEvento(
  evento: Evento,
  body: Record<string, unknown>
): Evento {
  const sets: string[] = [];
  const valores: Record<string, unknown> = { id: evento.id };

  for (const campo of CAMPOS_TEXTO) {
    if (campo in body) {
      sets.push(`${campo} = @${campo}`);
      valores[campo] = String(body[campo] ?? "").trim();
    }
  }
  for (const campo of CAMPOS_COLOR) {
    if (campo in body && colorValido(body[campo])) {
      sets.push(`${campo} = @${campo}`);
      valores[campo] = body[campo];
    }
  }
  if ("banner_texto" in body) {
    sets.push("banner_texto = @banner_texto");
    valores.banner_texto = body.banner_texto ? 1 : 0;
  }
  if ("slug" in body) {
    sets.push("slug = @slug");
    valores.slug = slugDisponible(slugify(String(body.slug)), evento.id);
  }
  if (sets.length) {
    db().prepare(`UPDATE eventos SET ${sets.join(", ")} WHERE id = @id`).run(valores);
  }
  return db().prepare("SELECT * FROM eventos WHERE id = ?").get(evento.id) as Evento;
}

export function eliminarEvento(evento: Evento) {
  const d = db();
  const fotos = d
    .prepare("SELECT archivo FROM photos WHERE evento_id = ?")
    .all(evento.id) as { archivo: string }[];
  d.transaction(() => {
    d.prepare("DELETE FROM guests WHERE evento_id = ?").run(evento.id);
    d.prepare("DELETE FROM messages WHERE evento_id = ?").run(evento.id);
    d.prepare("DELETE FROM photos WHERE evento_id = ?").run(evento.id);
    d.prepare("DELETE FROM eventos WHERE id = ?").run(evento.id);
  })();
  // Las imágenes del matrimonio dejan de estar referenciadas: se borran del disco.
  const subidos = [...fotos.map((f) => f.archivo), evento.banner, evento.mapa];
  for (const archivo of subidos) {
    if (archivo && NOMBRE_VALIDO.test(archivo)) {
      fs.rmSync(path.join(CARPETA, archivo), { force: true });
    }
  }
}

export function resumenEvento(id: number) {
  const fila = db()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM guests   WHERE evento_id = @id) AS invitados,
         (SELECT COUNT(DISTINCT mesa) FROM guests WHERE evento_id = @id AND mesa <> '') AS mesas,
         (SELECT COUNT(*) FROM messages WHERE evento_id = @id) AS mensajes,
         (SELECT COUNT(*) FROM photos   WHERE evento_id = @id) AS fotos`
    )
    .get({ id }) as {
    invitados: number;
    mesas: number;
    mensajes: number;
    fotos: number;
  };
  return fila;
}

// El banner y el mapa pueden ser un archivo subido o una ruta de /public.
export function urlArchivo(valor: string): string {
  if (!valor) return "";
  return valor.startsWith("/") ? valor : `/api/archivos/${valor}`;
}

export function nombreEvento(e: Evento): string {
  return `${e.nombre1} y ${e.nombre2}`;
}
