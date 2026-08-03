import { consultar, ejecutar, uno, Evento } from "./db";
import { COLORES } from "./config";
import { borrarArchivo } from "./archivos";

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
                          color_card, color_texto, color_dorado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
  return (await uno<Evento>("SELECT * FROM eventos WHERE id = ?", [
    Number(res.lastInsertRowid),
  ]))!;
}

const CAMPOS_TEXTO = ["nombre1", "nombre2", "fecha", "banner", "mapa"] as const;
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
  return (await uno<Evento>("SELECT * FROM eventos WHERE id = ?", [evento.id]))!;
}

export async function eliminarEvento(evento: Evento) {
  const fotos = await consultar<{ archivo: string }>(
    "SELECT archivo FROM photos WHERE evento_id = ?",
    [evento.id]
  );
  for (const tabla of ["guests", "messages", "photos"]) {
    await ejecutar(`DELETE FROM ${tabla} WHERE evento_id = ?`, [evento.id]);
  }
  await ejecutar("DELETE FROM eventos WHERE id = ?", [evento.id]);

  // Las imágenes del matrimonio dejan de estar referenciadas.
  for (const archivo of [...fotos.map((f) => f.archivo), evento.banner, evento.mapa]) {
    await borrarArchivo(archivo);
  }
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
