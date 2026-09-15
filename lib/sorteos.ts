import ExcelJS from "exceljs";
import { consultar, db, type Sorteo } from "./db";

// Todo lo que necesita un sorteo para saber quién entra al bombo: leer la base
// que sube el organizador (Excel o CSV), reconocer sus columnas y distinguir a
// cada persona para no repetirla.

export const LIMITES = {
  // Vercel corta el cuerpo de una petición a los 4,5 MB: más grande ni llega.
  bytes: 4 * 1024 * 1024,
  filas: 20000,
  columnas: 40,
  celda: 300,
};

export function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ------------------------------------------------------------ leer la base

export type Base = { columnas: string[]; filas: Record<string, string>[] };
type Lectura = { ok: true; base: Base } | { ok: false; error: string };

function textoCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    if ("richText" in valor) return valor.richText.map((r) => r.text).join("");
    if ("text" in valor) return String(valor.text ?? ""); // enlaces y correos
    if ("result" in valor) return textoCelda(valor.result as ExcelJS.CellValue); // fórmulas
    if ("error" in valor) return "";
  }
  return String(valor);
}

// Los CSV que exporta Excel en Chile vienen en Windows-1252 y separados por
// punto y coma; los de Google Sheets, en UTF-8 y con coma. Se aceptan los dos.
function decodificar(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function separador(texto: string): string {
  const primera = texto.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const sinComillas = primera.replace(/"[^"]*"/g, "");
  const cuenta = (c: string) => sinComillas.split(c).length - 1;
  return [";", "\t", ","].reduce((mejor, c) => (cuenta(c) > cuenta(mejor) ? c : mejor), ",");
}

function leerCsv(texto: string): string[][] {
  const sep = separador(texto);
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c !== '"') campo += c;
      else if (texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else comillas = false;
    } else if (c === '"' && campo === "") {
      comillas = true;
    } else if (c === sep) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

async function leerExcel(bytes: Uint8Array): Promise<string[][]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const hoja = libro.worksheets.find((h) => h.actualRowCount > 0);
  if (!hoja) return [];
  // Una fila de más que el límite basta para saber que se pasa.
  const ultima = Math.min(hoja.rowCount, LIMITES.filas + 12);
  const ancho = Math.min(hoja.columnCount, 200);
  const matriz: string[][] = [];
  for (let r = 1; r <= ultima; r++) {
    const fila = hoja.getRow(r);
    const celdas: string[] = [];
    for (let col = 1; col <= ancho; col++) celdas.push(textoCelda(fila.getCell(col).value));
    matriz.push(celdas);
  }
  return matriz;
}

// Encabezados que delatan que la primera fila son títulos y no una persona.
// Con \b para que "David" no pase por "id" ni "Ruth" por "rut".
const ENCABEZADOS_CONOCIDOS =
  /\b(nombres?|apellidos?|rut|run|correo|e?-?mail|participantes?|asistentes?|invitados?|codigo|id|dni|cedula|documento|telefono|celular|empresa|cargo|mesa|grupo|sede|area)\b/;

function armarBase(matriz: string[][]): Lectura {
  const limpia = matriz
    .map((fila) => fila.map((c) => c.replace(/\s+/g, " ").trim()))
    .filter((fila) => fila.some(Boolean));
  if (!limpia.length) return { ok: false, error: "El archivo no tiene datos." };

  // Algunas planillas traen una fila de título arriba: el encabezado es la fila
  // con más celdas llenas entre las primeras diez.
  let cabecera = 0;
  const llenas = (f: string[]) => f.filter(Boolean).length;
  for (let i = 1; i < Math.min(limpia.length, 10); i++) {
    if (llenas(limpia[i]) > llenas(limpia[cabecera])) cabecera = i;
  }

  // Las columnas vacías al final (formato sin datos) no cuentan.
  let ancho = 0;
  for (const fila of limpia.slice(cabecera)) {
    for (let c = fila.length - 1; c >= ancho; c--) {
      if (fila[c]) {
        ancho = c + 1;
        break;
      }
    }
  }
  if (ancho > LIMITES.columnas) {
    return {
      ok: false,
      error: `La base tiene ${ancho} columnas y el máximo es ${LIMITES.columnas}. Deja solo las que sirven para el sorteo.`,
    };
  }

  let encabezado = limpia[cabecera].slice(0, ancho);
  let datos = limpia.slice(cabecera + 1);

  // Una lista de puros nombres sin encabezado: la primera fila también es una
  // persona.
  if (ancho === 1 && !ENCABEZADOS_CONOCIDOS.test(normalizar(encabezado[0]))) {
    datos = [encabezado, ...datos];
    encabezado = ["Nombre"];
  }

  const vistos = new Map<string, number>();
  const columnas = encabezado.map((titulo, i) => {
    const base = titulo || `Columna ${i + 1}`;
    const veces = (vistos.get(normalizar(base)) ?? 0) + 1;
    vistos.set(normalizar(base), veces);
    return veces === 1 ? base : `${base} (${veces})`;
  });

  if (datos.length > LIMITES.filas) {
    return {
      ok: false,
      error: `La base tiene más de ${LIMITES.filas.toLocaleString("es-CL")} filas. Divídela en varios sorteos.`,
    };
  }

  const filas = datos
    .map((fila) => {
      const registro: Record<string, string> = {};
      columnas.forEach((col, i) => {
        registro[col] = (fila[i] ?? "").slice(0, LIMITES.celda);
      });
      return registro;
    })
    .filter((registro) => Object.values(registro).some(Boolean));

  if (!filas.length) return { ok: false, error: "La base tiene encabezados pero ninguna fila." };
  return { ok: true, base: { columnas, filas } };
}

export async function leerBase(archivo: File): Promise<Lectura> {
  if (archivo.size > LIMITES.bytes) {
    return { ok: false, error: "El archivo supera los 4 MB. Guárdalo como .xlsx, que pesa menos." };
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const nombre = archivo.name.toLowerCase();

  // Se mira el contenido y no solo la extensión: un .xlsx es un zip (PK) y un
  // .xls antiguo es otro formato que no se puede leer.
  const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const esXlsViejo = bytes[0] === 0xd0 && bytes[1] === 0xcf;
  if (esXlsViejo || nombre.endsWith(".xls")) {
    return {
      ok: false,
      error: "Ese es el formato antiguo de Excel (.xls). Ábrelo y guárdalo como .xlsx o .csv.",
    };
  }
  try {
    const matriz = esZip ? await leerExcel(bytes) : leerCsv(decodificar(bytes));
    return armarBase(matriz);
  } catch {
    return {
      ok: false,
      error: "No pudimos leer el archivo. Tiene que ser una planilla .xlsx o .csv.",
    };
  }
}

// ------------------------------------------------- reconocer las columnas

const PARECIDOS = {
  nombreCompleto: ["nombre completo", "nombre y apellido", "nombres y apellidos", "full name"],
  nombre: ["nombre", "nombres", "participante", "asistente", "invitado", "name", "first name"],
  apellido: ["apellido", "apellidos", "apellido paterno", "last name", "surname"],
  // En orden de preferencia: lo que mejor distingue a una persona.
  clave: [
    "rut", "run", "dni", "cedula", "documento", "numero de documento",
    "email", "correo", "correo electronico", "mail", "e-mail",
    "codigo", "n° entrada", "numero de entrada", "entrada", "ticket", "id",
  ],
};

function buscar(columnas: string[], parecidos: string[]): string {
  for (const p of parecidos) {
    const encontrada = columnas.find((c) => normalizar(c) === p);
    if (encontrada) return encontrada;
  }
  return "";
}

export function sugerirColumnas(columnas: string[]) {
  const completo = buscar(columnas, PARECIDOS.nombreCompleto);
  const nombre = completo || buscar(columnas, PARECIDOS.nombre) || columnas[0] || "";
  return {
    nombre,
    apellido: completo ? "" : buscar(columnas, PARECIDOS.apellido),
    clave: buscar(columnas, PARECIDOS.clave),
  };
}

// ---------------------------------------------------- guardar y borrar base

export async function guardarBase(sorteo: Sorteo, base: Base, archivo: string) {
  const sugeridas = sugerirColumnas(base.columnas);
  // Varias filas por INSERT para no ir a la base una vez por persona.
  const POR_SENTENCIA = 400;
  const sentencias: { sql: string; args: (string | number)[] }[] = [
    { sql: "DELETE FROM sorteo_participantes WHERE sorteo_id = ?", args: [sorteo.id] },
  ];
  for (let i = 0; i < base.filas.length; i += POR_SENTENCIA) {
    const tramo = base.filas.slice(i, i + POR_SENTENCIA);
    sentencias.push({
      sql: `INSERT INTO sorteo_participantes (sorteo_id, datos) VALUES ${tramo
        .map(() => "(?, ?)")
        .join(", ")}`,
      args: tramo.flatMap((fila) => [sorteo.id, JSON.stringify(fila)]),
    });
  }
  sentencias.push({
    sql: `UPDATE sorteos SET fuente = 'base', base_nombre = ?, columnas = ?,
                             columna_nombre = ?, columna_apellido = ?, columna_clave = ?
           WHERE id = ?`,
    args: [
      archivo.slice(0, 120),
      JSON.stringify(base.columnas),
      sugeridas.nombre,
      sugeridas.apellido,
      sugeridas.clave,
      sorteo.id,
    ],
  });
  // Todo en una transacción: la base nueva queda entera o se queda la anterior.
  const c = await db();
  await c.batch(sentencias, "write");
}

export async function borrarBase(sorteoId: number) {
  const c = await db();
  await c.batch(
    [
      { sql: "DELETE FROM sorteo_participantes WHERE sorteo_id = ?", args: [sorteoId] },
      {
        sql: `UPDATE sorteos SET base_nombre = '', columnas = '', columna_nombre = '',
                                 columna_apellido = '', columna_clave = ''
               WHERE id = ?`,
        args: [sorteoId],
      },
    ],
    "write"
  );
}

export function leerColumnas(sorteo: Pick<Sorteo, "columnas">): string[] {
  try {
    const valor = JSON.parse(sorteo.columnas || "[]");
    return Array.isArray(valor) ? valor.map(String) : [];
  } catch {
    return [];
  }
}

export async function muestraBase(sorteoId: number, cuantas = 5) {
  const [filas, total] = await Promise.all([
    consultar<{ datos: string }>(
      "SELECT datos FROM sorteo_participantes WHERE sorteo_id = ? ORDER BY id LIMIT ?",
      [sorteoId, cuantas]
    ),
    consultar<{ total: number }>(
      "SELECT COUNT(*) AS total FROM sorteo_participantes WHERE sorteo_id = ?",
      [sorteoId]
    ),
  ]);
  return {
    filas: Number(total[0]?.total ?? 0),
    muestra: filas.map((f) => leerRegistro(f.datos)),
  };
}

function leerRegistro(json: string): Record<string, string> {
  try {
    const valor = JSON.parse(json);
    return valor && typeof valor === "object" ? valor : {};
  } catch {
    return {};
  }
}

// ------------------------------------------------------------ participantes

export type Participante = {
  nombre: string;
  /**
   * Qué identifica a la persona: "id:" + la columna elegida (RUT, correo…) o,
   * si no hay, "n:" + el nombre. Dos filas con la misma clave son una persona.
   */
  clave: string;
  /** Las demás columnas, para el panel y el acta. Nunca se publican. */
  datos?: Record<string, string>;
};

// Un RUT se escribe con y sin puntos; un correo, con mayúsculas o no.
function claveDe(valor: string): string {
  const limpio = normalizar(valor).replace(/\s/g, "");
  return /^[\d.]+-?[\dk]$/.test(limpio) ? limpio.replace(/[.-]/g, "") : limpio;
}

export async function participantesDeSorteo(
  sorteo: Sorteo,
  eventoId: number
): Promise<Participante[]> {
  let todos: Participante[];

  if (sorteo.fuente === "base") {
    const filas = await consultar<{ datos: string }>(
      "SELECT datos FROM sorteo_participantes WHERE sorteo_id = ? ORDER BY id",
      [sorteo.id]
    );
    todos = filas.map(({ datos }) => {
      const registro = leerRegistro(datos);
      const nombre = [registro[sorteo.columna_nombre], registro[sorteo.columna_apellido]]
        .filter(Boolean)
        .join(" ")
        .trim();
      const id = sorteo.columna_clave ? registro[sorteo.columna_clave] ?? "" : "";
      return {
        nombre,
        clave: id ? `id:${claveDe(id)}` : `n:${normalizar(nombre)}`,
        datos: registro,
      };
    });
  } else if (sorteo.fuente === "lista") {
    todos = sorteo.lista
      .split("\n")
      .map((l) => l.trim())
      .map((nombre) => ({ nombre, clave: `n:${normalizar(nombre)}` }));
  } else if (sorteo.fuente === "mensajes") {
    const filas = await consultar<{ nombre: string }>(
      `SELECT DISTINCT TRIM(nombre) AS nombre FROM messages
        WHERE evento_id = ? AND TRIM(nombre) <> '' ORDER BY nombre`,
      [eventoId]
    );
    todos = filas.map((f) => ({ nombre: String(f.nombre), clave: `n:${normalizar(f.nombre)}` }));
  } else {
    // Invitados: la mesa y el grupo ayudan a ubicar al ganador en el salón.
    const filas = await consultar<{ nombre: string; mesa: string; grupo: string }>(
      `SELECT TRIM(nombre) AS nombre, mesa, grupo FROM guests
        WHERE evento_id = ? AND TRIM(nombre) <> '' ORDER BY nombre`,
      [eventoId]
    );
    todos = filas.map((f) => ({
      nombre: String(f.nombre),
      clave: `n:${normalizar(f.nombre)}`,
      datos: { Mesa: String(f.mesa ?? ""), Grupo: String(f.grupo ?? "") },
    }));
  }

  const vistos = new Set<string>();
  return todos.filter((p) => {
    if (!p.nombre || p.clave === "n:" || vistos.has(p.clave)) return false;
    vistos.add(p.clave);
    return true;
  });
}

// ------------------------------------------------------------- resultados

export type Resultado = Participante & { suplente: boolean; orden: number };

export function leerNombres(json: string): string[] {
  try {
    const valor = JSON.parse(json || "[]");
    return Array.isArray(valor) ? valor.filter((n): n is string => typeof n === "string") : [];
  } catch {
    return [];
  }
}

export function leerDetalle(json: string): Resultado[] {
  try {
    const valor = JSON.parse(json || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

/**
 * Quiénes ya ganaron en los otros sorteos del evento (solo ganadores, no
 * suplentes). Por clave cuando la persona venía con RUT o correo, y por nombre
 * para todo lo demás, que es lo único que se tiene.
 */
export async function ganadoresAnteriores(eventoId: number, excepto: number) {
  const otros = await consultar<{ ganadores: string; detalle: string }>(
    `SELECT ganadores, detalle FROM sorteos
      WHERE evento_id = ? AND id <> ? AND ganadores <> ''`,
    [eventoId, excepto]
  );
  const claves = new Set<string>();
  const nombres = new Set<string>();
  for (const otro of otros) {
    const detalle = leerDetalle(otro.detalle).filter((r) => !r.suplente);
    for (const r of detalle) {
      if (r.clave?.startsWith("id:")) claves.add(r.clave);
      nombres.add(normalizar(r.nombre));
    }
    // Sorteos ejecutados antes de que existiera el detalle.
    for (const nombre of leerNombres(otro.ganadores)) nombres.add(normalizar(nombre));
  }
  return {
    // Con RUT o correo se compara por eso: dos "Juan Pérez" pueden ser personas distintas.
    yaGano: (p: Participante) =>
      p.clave.startsWith("id:") ? claves.has(p.clave) : nombres.has(normalizar(p.nombre)),
    alguno: claves.size + nombres.size > 0,
  };
}
