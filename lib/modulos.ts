import type { Evento } from "./db";

// Lo único que necesita saber un módulo del matrimonio.
type DatosDeModulos = Pick<Evento, "modulos" | "mapa">;

// Catálogo de módulos del producto. Cada matrimonio decide cuáles muestra y en
// qué orden (columna `modulos` de la tabla eventos, JSON). Agregar un módulo
// nuevo aquí lo deja disponible en el panel sin tocar ninguna otra pantalla.

export type ModuloId =
  | "registro"
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
    id: "registro",
    nombre: "Registro",
    descripcion: "Registro de participantes, consentimientos y datos de contacto, sin crear una cuenta.",
    ruta: "registro",
    tarjeta: "Regístrate para participar\ny recibir información",
    boton: "Registrarme",
  },
  {
    id: "mesa",
    nombre: "Sector",
    descripcion: "Cada participante busca su nombre y ve su sector (en un matrimonio, su mesa). Los sectores se asignan en Participantes.",
    ruta: "mesa",
    tarjeta: "Busca tu mesa",
    boton: "Buscar mi mesa",
    destacado: true,
  },
  {
    id: "mensajes",
    nombre: "Mensajes",
    descripcion: "Los participantes dejan un saludo escrito que puede salir en la pantalla en vivo.",
    ruta: "mensaje",
    tarjeta: "Deja tus buenos deseos\npara los novios",
    boton: "Enviar mensaje",
  },
  {
    id: "fotos",
    nombre: "Fotos",
    descripcion: "Galería colaborativa: cada participante sube sus fotos.",
    ruta: "foto",
    tarjeta: "Comparte tus mejores\nmomentos del evento",
    boton: "Subir foto",
  },
  {
    id: "mapa",
    nombre: "Mapa",
    descripcion: "El plano del lugar, con zonas que el participante toca para ver qué hay en cada una. Se arma en la pestaña Mapa.",
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
    descripcion: "Preguntas para conocer la opinión o los datos de los participantes.",
    ruta: "encuesta",
    tarjeta: "Cuéntanos lo que\npiensas en un minuto",
    boton: "Responder",
  },
  {
    id: "votaciones",
    nombre: "Votaciones",
    descripcion: "Los participantes eligen entre alternativas y se ven los resultados, también en la pantalla en vivo.",
    ruta: "votacion",
    tarjeta: "Vota y elige tu\nopción favorita",
    boton: "Votar",
  },
  {
    id: "sorteos",
    nombre: "Sorteos",
    descripcion: "Elegir ganadores al azar entre los participantes o quienes se inscriban escaneando el QR.",
    ruta: "sorteo",
    tarjeta: "Mira quién se gana\nlos premios de la noche",
    boton: "Ver sorteos",
  },
  {
    id: "trivia",
    nombre: "Trivia",
    descripcion: "Juego de preguntas con alternativas de texto o con fotos.",
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

/** Solo los que se le muestran al participante, en orden. */
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
