import type { Evento } from "./db";

// La paleta clásica se conserva en los matrimonios existentes y nuevos.
export const COLORES = {
  fondo: "#fef3f0",
  rosa: "#edb9cf",
  card: "#eee8e9",
  texto: "#58595b",
  dorado: "#c1b065",
} as const;

export type Paleta = Record<keyof typeof COLORES, string>;

export const COLORES_ACTIVACION: Paleta = {
  fondo: "#e9f3fd",
  rosa: "#1e70bb",
  card: "#edf6fd",
  texto: "#001740",
  dorado: "#b9e7fb",
};

export function coloresPorTipo(tipo: Evento["tipo"]): Paleta {
  return tipo === "activacion" ? COLORES_ACTIVACION : COLORES;
}

type EventoConColores = Pick<Evento, "tipo" | "color_fondo" | "color_rosa" | "color_card" | "color_texto" | "color_dorado">;
const CAMPOS_PALETA = {
  fondo: "color_fondo", rosa: "color_rosa", card: "color_card", texto: "color_texto", dorado: "color_dorado",
} as const;

/** Una activación antigua con la paleta clásica completa recibe el diseño deportivo.
 * Cualquier paleta personalizada se conserva, sin modificar datos en la base. */
export function paletaEvento(evento: EventoConColores): Paleta {
  const claves = Object.keys(CAMPOS_PALETA) as (keyof Paleta)[];
  const esClasica = claves.every((clave) => evento[CAMPOS_PALETA[clave]]?.toLowerCase() === COLORES[clave]);
  if (evento.tipo === "activacion" && esClasica) return { ...COLORES_ACTIVACION };
  const defaults = coloresPorTipo(evento.tipo);
  return Object.fromEntries(claves.map((clave) => {
    const valor = evento[CAMPOS_PALETA[clave]];
    return [clave, /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : defaults[clave]];
  })) as Paleta;
}

export const DISENO_CAROZZI = {
  titulo: "Corrida Carozzi",
  fecha: "Octubre 2026",
  descripcion: "Regístrate para participar en nuestra activación durante Corrida Carozzi y continúa con la dinámica en el stand.",
  banner: "/design/carozzi-registro.webp",
  banner_movil: "/design/carozzi-registro.webp",
  banner_texto: 0,
  color_fondo: COLORES_ACTIVACION.fondo,
  color_rosa: COLORES_ACTIVACION.rosa,
  color_card: COLORES_ACTIVACION.card,
  color_texto: COLORES_ACTIVACION.texto,
  color_dorado: COLORES_ACTIVACION.dorado,
};

export const PALETAS_ACTIVACION: { nombre: string; colores: Paleta }[] = [
  { nombre: "Azul deportivo", colores: COLORES_ACTIVACION },
  { nombre: "Blanco y azul", colores: { fondo: "#ffffff", rosa: "#1e70bb", card: "#edf6fd", texto: "#001740", dorado: "#b9e7fb" } },
  { nombre: "Grafito", colores: { fondo: "#f4f6f8", rosa: "#243c5a", card: "#ffffff", texto: "#172334", dorado: "#dce5ee" } },
];

// Paletas listas para elegir de una en el panel. La primera es la del producto.
export const PALETAS: { nombre: string; colores: Paleta }[] = [
  { nombre: "Rosa clásico", colores: COLORES },
  {
    nombre: "Verde salvia",
    colores: {
      fondo: "#f3f6f1",
      rosa: "#9caf88",
      card: "#e6ebe1",
      texto: "#4a5348",
      dorado: "#b08d57",
    },
  },
  {
    nombre: "Azul sereno",
    colores: {
      fondo: "#f2f5f9",
      rosa: "#7b93b8",
      card: "#e3e9f1",
      texto: "#3c4657",
      dorado: "#c2a25c",
    },
  },
  {
    nombre: "Terracota",
    colores: {
      fondo: "#fdf4ef",
      rosa: "#c97b5a",
      card: "#f0e4dc",
      texto: "#5b4034",
      dorado: "#b8934f",
    },
  },
  {
    nombre: "Lavanda",
    colores: {
      fondo: "#f6f3fa",
      rosa: "#a894c4",
      card: "#eae4f2",
      texto: "#4f4560",
      dorado: "#bda45f",
    },
  },
  {
    nombre: "Arena",
    colores: {
      fondo: "#faf7f2",
      rosa: "#8c8378",
      card: "#ece7de",
      texto: "#3a3733",
      dorado: "#a08a55",
    },
  },
];

export const PRODUCTO = {
  nombre: "Venito",
  descripcion: "Tu evento en un solo lugar. Participa, comparte y guarda tus mejores momentos.",
};
