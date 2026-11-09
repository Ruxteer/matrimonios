// Mapa interactivo: zonas que el invitado toca sobre el plano y una leyenda
// debajo. Todo vive como JSON en eventos.mapa_config. Puro y sin dependencias
// de servidor: lo usan el panel, las páginas del invitado y la API.
import { slugify } from "./slug";

// Catálogo cerrado de íconos: el panel elige entre estos y la página del
// invitado los dibuja (components/IconosMapa.tsx). Un id desconocido cae a "punto".
export const ICONOS_MAPA = [
  ["punto", "Punto"],
  ["camara", "Fotos"],
  ["foodtruck", "Foodtruck"],
  ["experiencia", "Experiencias"],
  ["banos", "Baños"],
  ["escenario", "Escenario"],
  ["musica", "Música"],
  ["microfono", "Micrófono"],
  ["estrella", "Destacado"],
  ["rayo", "Energía"],
  ["corona", "VIP"],
  ["sofa", "Lounge"],
  ["bar", "Bar"],
  ["vino", "Vino"],
  ["cerveza", "Cerveza"],
  ["cafe", "Café"],
  ["comida", "Comida"],
  ["bebida", "Bebidas"],
  ["premium", "Premium"],
  ["regalo", "Regalos"],
  ["entrada", "Entrada"],
  ["ticket", "Tickets"],
  ["informacion", "Información"],
  ["estacionamiento", "Estacionamiento"],
  ["primeros-auxilios", "Primeros auxilios"],
  ["accesibilidad", "Accesibilidad"],
  ["tienda", "Tienda"],
  ["juegos", "Juegos"],
  ["ceremonia", "Ceremonia"],
  ["pista", "Pista de baile"],
  ["torta", "Torta"],
  ["jardin", "Jardín"],
  ["refrescar", "Refrescar"],
  ["wifi", "Wi-Fi"],
  ["trofeo", "Premios"],
  ["meta", "Meta"],
  ["agua", "Hidratación"],
  ["transporte", "Transporte"],
  ["seguridad", "Seguridad"],
] as const;

export type IconoMapa = (typeof ICONOS_MAPA)[number][0];

const IDS_ICONO = new Set<string>(ICONOS_MAPA.map(([id]) => id));

export function esIconoMapa(v: unknown): v is IconoMapa {
  return typeof v === "string" && IDS_ICONO.has(v);
}

export type DetalleZona = { icono: IconoMapa; texto: string };

export type ZonaMapa = {
  /** Segmento de la dirección: /<evento>/mapa/<id>. Sale del nombre. */
  id: string;
  nombre: string;
  /** Posición sobre el plano, en porcentaje del ancho y del alto (0–100). */
  x: number;
  y: number;
  icono: IconoMapa;
  descripcion: string;
  /** Foto de la zona (nombre de archivo subido). */
  imagen: string;
  /** Lo que ofrece la zona: hasta 4 etiquetas con ícono. */
  detalles: DetalleZona[];
};

export type ItemLeyenda = { icono: IconoMapa; texto: string };

export type ConfigMapa = {
  /** Texto bajo "Explora el lugar". Vacío = el texto por defecto si hay zonas. */
  subtitulo: string;
  zonas: ZonaMapa[];
  leyenda: ItemLeyenda[];
};

export const SUBTITULO_MAPA =
  "Toca cada zona del mapa y descubre su ubicación, servicios y experiencias.";

export const LIMITES_MAPA = {
  zonas: 40,
  detalles: 4,
  leyenda: 8,
  nombre: 60,
  descripcion: 600,
  texto: 40,
  subtitulo: 200,
} as const;

export const MAPA_VACIO: ConfigMapa = { subtitulo: "", zonas: [], leyenda: [] };

// Una imagen de zona es un archivo subido por el panel (20 hex + extensión) o
// un recurso propio del sitio. Nada más: el valor termina en un <img src>.
function imagenValida(v: unknown): string {
  if (typeof v !== "string") return "";
  if (/^[a-f0-9]{20}\.[a-z]{3,4}$/.test(v)) return v;
  if (/^\/(design|brand)\/[\w.-]+$/.test(v)) return v;
  return "";
}

const texto = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const porcentaje = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;
};

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function etiquetas(v: unknown, max: number): { icono: IconoMapa; texto: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(objeto)
    .map((d) => ({
      icono: esIconoMapa(d.icono) ? d.icono : ("punto" as IconoMapa),
      texto: texto(d.texto, LIMITES_MAPA.texto),
    }))
    .filter((d) => d.texto)
    .slice(0, max);
}

/** Valida y completa lo que manda el panel o lo que hay guardado. */
export function limpiarMapa(valor: unknown): ConfigMapa {
  const crudo = objeto(valor);
  const usados = new Set<string>();
  const zonas = (Array.isArray(crudo.zonas) ? crudo.zonas : [])
    .map(objeto)
    .slice(0, LIMITES_MAPA.zonas)
    .map((z, i): ZonaMapa => {
      const nombre = texto(z.nombre, LIMITES_MAPA.nombre) || `Zona ${i + 1}`;
      // La dirección sale del nombre; dos zonas con el mismo nombre no chocan.
      const raiz = slugify(nombre) || "zona";
      let id = raiz;
      for (let n = 2; usados.has(id); n++) id = `${raiz}-${n}`;
      usados.add(id);
      return {
        id,
        nombre,
        x: porcentaje(z.x),
        y: porcentaje(z.y),
        icono: esIconoMapa(z.icono) ? z.icono : "punto",
        descripcion: texto(z.descripcion, LIMITES_MAPA.descripcion),
        imagen: imagenValida(z.imagen),
        detalles: etiquetas(z.detalles, LIMITES_MAPA.detalles),
      };
    });
  return {
    subtitulo: texto(crudo.subtitulo, LIMITES_MAPA.subtitulo),
    zonas,
    leyenda: etiquetas(crudo.leyenda, LIMITES_MAPA.leyenda),
  };
}

/** Lo guardado en la base, listo para usar. Un JSON roto es un mapa sin zonas. */
export function leerMapa(json: string): ConfigMapa {
  if (!json) return MAPA_VACIO;
  try {
    return limpiarMapa(JSON.parse(json));
  } catch {
    return MAPA_VACIO;
  }
}

/** Para guardar: siempre un JSON válido y acotado. */
export function normalizarMapa(valor: unknown): string {
  return JSON.stringify(limpiarMapa(valor));
}

/** Fotos de zonas que ocupa un mapa guardado (para borrar las que se dejan de usar). */
export function imagenesDeMapa(json: string): string[] {
  return leerMapa(json)
    .zonas.map((z) => z.imagen)
    .filter((img) => img && !img.startsWith("/"));
}
