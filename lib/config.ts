// Valores por defecto del producto: se copian a cada matrimonio nuevo
// y después se editan desde el panel de ajustes.
export const COLORES = {
  fondo: "#fef3f0",
  rosa: "#edb9cf",
  card: "#eee8e9",
  texto: "#58595b",
  dorado: "#c1b065",
} as const;

export type Paleta = Record<keyof typeof COLORES, string>;

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
  nombre: "Matrimonios",
  descripcion: "Busca tu mesa, deja tus buenos deseos y comparte tus fotos.",
};
