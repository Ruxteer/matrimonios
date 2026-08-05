import type { Evento } from "./db";

// Lo único que necesita saber un módulo del matrimonio.
type DatosDeModulos = Pick<Evento, "modulos" | "mapa">;

// Catálogo de módulos del producto. Cada matrimonio decide cuáles muestra y en
// qué orden (columna `modulos` de la tabla eventos, JSON). Agregar un módulo
// nuevo aquí lo deja disponible en el panel sin tocar ninguna otra pantalla.

export type ModuloId =
  | "mesa"
  | "mensajes"
  | "fotos"
  | "mapa"
  | "agenda"
  | "encuestas"
  | "votaciones"
  | "sorteos"
  | "trivia";

export type Modulo = {
  id: ModuloId;
  /** Nombre corto, para las pestañas y la lista del panel. */
  nombre: string;
  /** Qué hace, para que el organizador sepa qué está encendiendo. */
  descripcion: string;
  /** Segmento público: /<matrimonio>/<ruta>. */
  ruta: string;
  /** Texto de la tarjeta del inicio (los saltos de línea se respetan). */
  tarjeta: string;
  /** Texto del botón de la tarjeta y del atajo. */
  boton: string;
  /** Campo del evento que el módulo necesita para poder mostrarse. */
  requiere?: "mapa";
  /** El buscador de mesa va arriba del inicio, no como tarjeta. */
  destacado?: true;
};

export const MODULOS: Modulo[] = [
  {
    id: "mesa",
    nombre: "Mesa",
    descripcion: "Cada invitado busca su nombre y ve la mesa que le tocó.",
    ruta: "mesa",
    tarjeta: "Busca tu mesa",
    boton: "Buscar mi mesa",
    destacado: true,
  },
  {
    id: "mensajes",
    nombre: "Mensajes",
    descripcion: "Los invitados dejan un saludo escrito para los novios.",
    ruta: "mensaje",
    tarjeta: "Deja tus buenos deseos\npara los novios",
    boton: "Enviar mensaje",
  },
  {
    id: "fotos",
    nombre: "Fotos",
    descripcion: "Galería colaborativa: cada invitado sube sus fotos.",
    ruta: "foto",
    tarjeta: "Comparte tus mejores\nmomentos del evento",
    boton: "Subir foto",
  },
  {
    id: "mapa",
    nombre: "Mapa",
    descripcion: "El plano del lugar. Necesita que subas una imagen en Ajustes.",
    ruta: "mapa",
    tarjeta: "Explora el plano y\nencuentra todo fácilmente",
    boton: "Ver mapa",
    requiere: "mapa",
  },
  {
    id: "agenda",
    nombre: "Agenda",
    descripcion: "La programación del día: ceremonia, cóctel, cena, fiesta.",
    ruta: "agenda",
    tarjeta: "Revisa el programa\nde la celebración",
    boton: "Ver agenda",
  },
  {
    id: "encuestas",
    nombre: "Encuestas",
    descripcion: "Preguntas para conocer la opinión o los datos de los invitados.",
    ruta: "encuesta",
    tarjeta: "Cuéntanos lo que\npiensas en un minuto",
    boton: "Responder",
  },
  {
    id: "votaciones",
    nombre: "Votaciones",
    descripcion: "Los invitados eligen entre alternativas y se ven los resultados.",
    ruta: "votacion",
    tarjeta: "Vota y elige tu\nopción favorita",
    boton: "Votar",
  },
  {
    id: "sorteos",
    nombre: "Sorteos",
    descripcion: "Elegir ganadores al azar entre los invitados o quienes participaron.",
    ruta: "sorteo",
    tarjeta: "Mira quién se gana\nlos premios de la noche",
    boton: "Ver sorteos",
  },
  {
    id: "trivia",
    nombre: "Trivia",
    descripcion: "Juego de preguntas: ¿cuánto conoces a los novios?",
    ruta: "trivia",
    tarjeta: "¿Cuánto conoces\na los novios?",
    boton: "Jugar",
  },
];

// Lo que trae encendido un matrimonio nuevo: lo que el producto ya hacía antes
// de que existieran los módulos configurables.
const POR_DEFECTO: ModuloId[] = ["mesa", "mensajes", "fotos", "mapa"];

const PORID = new Map(MODULOS.map((m) => [m.id, m]));

export function esModuloId(v: unknown): v is ModuloId {
  return typeof v === "string" && PORID.has(v as ModuloId);
}

export function definicion(id: ModuloId): Modulo {
  return PORID.get(id)!;
}

type Guardado = { id: ModuloId; activo: boolean };

// Lee la configuración guardada y la completa con el catálogo: las bases
// anteriores (columna vacía) y los módulos que se agreguen después quedan con
// su valor por defecto en vez de desaparecer.
function leer(evento: DatosDeModulos): Guardado[] {
  let crudo: unknown = null;
  try {
    crudo = JSON.parse(evento.modulos || "[]");
  } catch {
    crudo = null;
  }
  const filas: Guardado[] = [];
  const vistos = new Set<ModuloId>();
  if (Array.isArray(crudo)) {
    for (const item of crudo) {
      const id = (item as { id?: unknown })?.id;
      if (!esModuloId(id) || vistos.has(id)) continue;
      vistos.add(id);
      filas.push({ id, activo: Boolean((item as { activo?: unknown }).activo) });
    }
  }
  for (const m of MODULOS) {
    if (!vistos.has(m.id)) filas.push({ id: m.id, activo: POR_DEFECTO.includes(m.id) });
  }
  return filas;
}

/** Todos los módulos en el orden del matrimonio, encendidos y apagados. */
export function modulosDeEvento(evento: DatosDeModulos): { modulo: Modulo; activo: boolean }[] {
  return leer(evento).map((f) => ({ modulo: definicion(f.id), activo: f.activo }));
}

/** Solo los que se le muestran al invitado, en orden. */
export function modulosActivos(evento: DatosDeModulos): Modulo[] {
  return modulosDeEvento(evento)
    .filter(({ modulo, activo }) => activo && (!modulo.requiere || evento[modulo.requiere]))
    .map(({ modulo }) => modulo);
}

export function moduloActivo(evento: DatosDeModulos, id: ModuloId): boolean {
  return modulosActivos(evento).some((m) => m.id === id);
}

/** Normaliza lo que manda el panel antes de guardarlo. */
export function normalizarModulos(valor: unknown): string | null {
  if (!Array.isArray(valor)) return null;
  const filas: Guardado[] = [];
  const vistos = new Set<ModuloId>();
  for (const item of valor) {
    const id = (item as { id?: unknown })?.id;
    if (!esModuloId(id) || vistos.has(id)) continue;
    vistos.add(id);
    filas.push({ id, activo: Boolean((item as { activo?: unknown }).activo) });
  }
  if (!filas.length) return null;
  return JSON.stringify(filas);
}
