import type { Evento } from "./db";
import { definicion, esModuloId, type ModuloId } from "./modulos";

// Los textos que ve el participante en cada módulo: el título de su página, el
// texto de su tarjeta en el inicio y el del botón (CTA). Cada evento puede
// cambiarlos en la pestaña Módulos; lo que deja vacío usa el predeterminado.
// Sin dependencias del servidor: lo usan el sitio y la vista previa del panel.

export type CampoTexto = "titulo" | "tarjeta" | "boton";
export type TextosModulo = Record<CampoTexto, string>;
export type TextosInicio = { saludo: string; durante: string };
/**
 * Lo que entrega el módulo Sector: "mesa" en un matrimonio, "sector" en una
 * activación, u otra palabra (sala, stand…) que fija la clave maestra. El
 * género arma "asignada" o "asignado". Nombre vacío = el predeterminado.
 */
export type Asignacion = { nombre: string; femenino: boolean };
export type Textos = TextosInicio & {
  modulos: Partial<Record<ModuloId, Partial<TextosModulo>>>;
  asignacion: Asignacion;
};

type DatosEvento = Pick<Evento, "textos" | "tipo">;

export const LARGOS: Record<CampoTexto | keyof TextosInicio | "asignacion", number> = {
  titulo: 80,
  tarjeta: 90,
  boton: 30,
  saludo: 80,
  durante: 80,
  asignacion: 30,
};

export const SIN_ASIGNACION: Asignacion = { nombre: "", femenino: true };

export const INICIO_PREDETERMINADO: TextosInicio = {
  saludo: "Hola, nos alegra que estés aquí",
  durante: "Durante el evento podrás:",
};

const TITULOS: Record<ModuloId, string> = {
  registro: "Regístrate para participar",
  mesa: "Busca tu mesa",
  mensajes: "Déjanos tus buenos deseos",
  fotos: "Comparte tus mejores momentos",
  mapa: "Explora el lugar",
  agenda: "El programa del día",
  encuestas: "Queremos conocer tu opinión",
  votaciones: "Vota y elige tu favorita",
  sorteos: "Los sorteos de la noche",
  trivia: "Pon a prueba lo que sabes",
};

// En una activación no hay novios ni mesas: hay sectores y una marca.
const EN_ACTIVACION: Partial<Record<ModuloId, Partial<TextosModulo>>> = {
  mesa: { titulo: "Busca tu sector", tarjeta: "Busca tu sector", boton: "Buscar mi sector" },
  mensajes: { titulo: "Déjanos tu mensaje", tarjeta: "Deja tu mensaje\ny aparece en pantalla" },
  trivia: { tarjeta: "¿Cuánto sabes?\nPon a prueba lo que sabes" },
  sorteos: { titulo: "Los sorteos del evento", tarjeta: "Participa y mira quién\nse lleva los premios" },
};

/** Los módulos cuyo título no se edita aquí (el registro tiene el suyo en su pestaña). */
export const SIN_TITULO: ModuloId[] = ["registro"];

/** La palabra que usa el módulo Sector en este evento, con su género. */
export function asignacionDe(tipo: Evento["tipo"], propia: Asignacion = SIN_ASIGNACION): Asignacion {
  if (propia.nombre) return propia;
  return tipo === "activacion" ? { nombre: "sector", femenino: false } : { nombre: "mesa", femenino: true };
}

export function predeterminados(tipo: Evento["tipo"], id: ModuloId, asignacion: Asignacion = SIN_ASIGNACION): TextosModulo {
  const modulo = definicion(id);
  // Con una palabra propia, los textos del buscador la usan: "Busca tu sala".
  const propia = id === "mesa" && asignacion.nombre
    ? { titulo: `Busca tu ${asignacion.nombre}`, tarjeta: `Busca tu ${asignacion.nombre}`, boton: `Buscar mi ${asignacion.nombre}` }
    : {};
  return {
    titulo: TITULOS[id],
    tarjeta: modulo.tarjeta,
    boton: modulo.boton,
    ...(tipo === "activacion" ? EN_ACTIVACION[id] : {}),
    ...propia,
  };
}

function texto(valor: unknown, largo: number): string {
  if (typeof valor !== "string") return "";
  // La tarjeta admite un salto de línea (así viene el diseño); nada más.
  return valor.replace(/\r/g, "").replace(/\n{2,}/g, "\n").trim().slice(0, largo);
}

/** Lee lo guardado y descarta lo que no corresponde. Vacío = predeterminado. */
export function leerTextos(valor: unknown): Textos {
  let crudo = valor;
  if (typeof crudo === "string") {
    try {
      crudo = JSON.parse(crudo || "{}");
    } catch {
      crudo = {};
    }
  }
  const datos = crudo && typeof crudo === "object" && !Array.isArray(crudo)
    ? (crudo as Record<string, unknown>)
    : {};
  const modulos: Textos["modulos"] = {};
  const crudos = datos.modulos && typeof datos.modulos === "object" ? (datos.modulos as Record<string, unknown>) : {};
  for (const [id, valores] of Object.entries(crudos)) {
    if (!esModuloId(id) || !valores || typeof valores !== "object") continue;
    const fila: Partial<TextosModulo> = {};
    for (const campo of ["titulo", "tarjeta", "boton"] as const) {
      const limpio = texto((valores as Record<string, unknown>)[campo], LARGOS[campo]);
      // El título y el botón son de una línea.
      const final = campo === "tarjeta" ? limpio : limpio.replace(/\n/g, " ");
      if (final) fila[campo] = final;
    }
    if (Object.keys(fila).length) modulos[id] = fila;
  }
  return {
    saludo: texto(datos.saludo, LARGOS.saludo).replace(/\n/g, " "),
    durante: texto(datos.durante, LARGOS.durante).replace(/\n/g, " "),
    modulos,
    asignacion: leerAsignacion(datos.asignacion),
  };
}

function leerAsignacion(valor: unknown): Asignacion {
  if (!valor || typeof valor !== "object") return SIN_ASIGNACION;
  const crudo = valor as Record<string, unknown>;
  let nombre = texto(crudo.nombre, LARGOS.asignacion).replace(/\s+/g, " ");
  // Va a mitad de frase ("Tu sala asignada es:"): sin mayúscula inicial,
  // salvo que sea una sigla ("VIP").
  if (!/^\p{Lu}{2}/u.test(nombre)) nombre = nombre.charAt(0).toLocaleLowerCase("es-CL") + nombre.slice(1);
  return nombre ? { nombre, femenino: crudo.femenino !== false } : SIN_ASIGNACION;
}

export function normalizarTextos(valor: unknown, tipo: Evento["tipo"]): string {
  const limpios = leerTextos(valor);
  // Un texto igual al predeterminado no se guarda: así, si mañana cambia el
  // predeterminado, el evento lo recibe.
  // Una palabra igual a la predeterminada tampoco se guarda.
  const porDefecto = asignacionDe(tipo);
  if (limpios.asignacion.nombre === porDefecto.nombre && limpios.asignacion.femenino === porDefecto.femenino) {
    limpios.asignacion = SIN_ASIGNACION;
  }
  for (const [id, fila] of Object.entries(limpios.modulos) as [ModuloId, Partial<TextosModulo>][]) {
    const base = predeterminados(tipo, id, limpios.asignacion);
    for (const campo of Object.keys(fila) as CampoTexto[]) {
      if (fila[campo] === base[campo] || (campo === "titulo" && SIN_TITULO.includes(id))) delete fila[campo];
    }
    if (!Object.keys(fila).length) delete limpios.modulos[id];
  }
  if (limpios.saludo === INICIO_PREDETERMINADO.saludo) limpios.saludo = "";
  if (limpios.durante === INICIO_PREDETERMINADO.durante) limpios.durante = "";
  if (!limpios.asignacion.nombre) delete (limpios as Partial<Textos>).asignacion;
  return JSON.stringify(limpios);
}

/** Los tres textos del módulo, con lo propio del evento encima de lo predeterminado. */
export function textosModulo(evento: DatosEvento, id: ModuloId): TextosModulo {
  const guardados = leerTextos(evento.textos);
  const propios = guardados.modulos[id] ?? {};
  const base = predeterminados(evento.tipo, id, guardados.asignacion);
  return {
    titulo: propios.titulo || base.titulo,
    tarjeta: propios.tarjeta || base.tarjeta,
    boton: propios.boton || base.boton,
  };
}

/** Solo lo que el evento cambió (para las pantallas con diseño propio). */
export function textosPropios(evento: DatosEvento, id: ModuloId): Partial<TextosModulo> {
  return leerTextos(evento.textos).modulos[id] ?? {};
}

export function textosInicio(evento: DatosEvento): TextosInicio {
  const propios = leerTextos(evento.textos);
  return {
    saludo: propios.saludo || INICIO_PREDETERMINADO.saludo,
    durante: propios.durante || INICIO_PREDETERMINADO.durante,
  };
}

/** La palabra del módulo Sector de este evento ("mesa", "sector", "sala"…). */
export function asignacionEvento(evento: DatosEvento): Asignacion {
  return asignacionDe(evento.tipo, leerTextos(evento.textos).asignacion);
}
