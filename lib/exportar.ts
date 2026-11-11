// Descargas de los módulos para el panel (Excel y CSV), como la del Registro.
// Cada módulo arma sus hojas: el Excel las trae todas y el CSV, que es una
// sola tabla, trae la que sirve para trabajar los datos fila por fila.
import { consultar } from "./db";
import type { Encuesta, PreguntaEncuesta, Sorteo, Trivia, Votacion } from "./db";
import { respuestaCsv } from "./csv";
import { leerColumnas, leerDetalle, leerNombres, type Resultado } from "./sorteos";

export const MODULOS_EXPORTABLES = ["mensajes", "encuestas", "votaciones", "sorteos", "trivia"] as const;
export type ModuloExportable = (typeof MODULOS_EXPORTABLES)[number];

type Celda = string | number;
export type Hoja = { nombre: string; cabecera: string[]; filas: Celda[][] };
export type Exportacion = { hojas: Hoja[]; csv: Hoja };

const FUENTE_SORTEO: Record<string, string> = {
  invitados: "Participantes de la lista",
  mensajes: "Quienes dejaron un mensaje",
  fotos: "Quienes compartieron fotos",
  lista: "Lista escrita en el panel",
  base: "Base importada",
  inscritos: "Inscritos con el QR",
};

/** Las fechas se guardan en UTC; la planilla va en hora de Chile («11-11-2026 08:52»). */
export function fechaChile(valor: string): string {
  if (!valor) return "";
  const fecha = new Date(valor.includes("T") ? valor : `${valor.replace(" ", "T")}Z`);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha
    .toLocaleString("es-CL", {
      timeZone: "America/Santiago",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    .replace(",", "");
}

function lista(json: string): string[] {
  try {
    const valor = JSON.parse(json || "[]");
    return Array.isArray(valor) ? valor.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------- mensajes

const ESTADO_MENSAJE: Record<string, string> = { pendiente: "Pendiente", aprobada: "Aprobado", rechazada: "Rechazado" };

// Todos los mensajes, del más antiguo al más nuevo, con su estado de aprobación.
async function mensajes(eventoId: number): Promise<Exportacion> {
  const filas = await consultar<{ nombre: string; mensaje: string; estado: string; created_at: string }>(
    "SELECT nombre, mensaje, estado, created_at FROM messages WHERE evento_id = ? ORDER BY created_at, id",
    [eventoId]
  );
  const hoja: Hoja = {
    nombre: "Mensajes",
    cabecera: ["Nombre", "Mensaje", "Estado", "Fecha"],
    filas: filas.map((m) => [
      String(m.nombre),
      String(m.mensaje),
      ESTADO_MENSAJE[String(m.estado)] ?? String(m.estado),
      fechaChile(String(m.created_at)),
    ]),
  };
  return { hojas: [hoja], csv: hoja };
}

// ---------------------------------------------------------------- encuestas

function valorEncuesta(pregunta: PreguntaEncuesta | undefined, valor: string): string {
  if (!pregunta) return valor;
  if (pregunta.tipo === "multiple") return lista(valor).join(" / ");
  if (pregunta.tipo === "si_no") return valor === "si" ? "Sí" : valor === "no" ? "No" : valor;
  return valor;
}

// Excel: una hoja por encuesta, una fila por respuesta y una columna por
// pregunta. CSV: todas las encuestas juntas, una fila por pregunta respondida.
async function encuestas(eventoId: number): Promise<Exportacion> {
  const lasEncuestas = await consultar<Encuesta>(
    "SELECT * FROM encuestas WHERE evento_id = ? ORDER BY orden, id",
    [eventoId]
  );
  const preguntas = await consultar<PreguntaEncuesta>(
    `SELECT p.* FROM encuesta_preguntas p JOIN encuestas e ON e.id = p.encuesta_id
      WHERE e.evento_id = ? ORDER BY p.orden, p.id`,
    [eventoId]
  );
  const respuestas = await consultar<{ id: number; encuesta_id: number; participante: string; created_at: string }>(
    `SELECT r.id, r.encuesta_id, r.participante, r.created_at FROM encuesta_respuestas r
       JOIN encuestas e ON e.id = r.encuesta_id
      WHERE e.evento_id = ? ORDER BY r.created_at, r.id`,
    [eventoId]
  );
  const valores = await consultar<{ respuesta_id: number; pregunta_id: number; valor: string }>(
    `SELECT v.respuesta_id, v.pregunta_id, v.valor FROM encuesta_valores v
       JOIN encuesta_respuestas r ON r.id = v.respuesta_id
       JOIN encuestas e ON e.id = r.encuesta_id
      WHERE e.evento_id = ?`,
    [eventoId]
  );
  const preguntaPorId = new Map(preguntas.map((p) => [Number(p.id), p]));
  const porRespuesta = new Map<number, Map<number, string>>();
  for (const v of valores) {
    const mapa = porRespuesta.get(Number(v.respuesta_id)) ?? new Map<number, string>();
    mapa.set(Number(v.pregunta_id), valorEncuesta(preguntaPorId.get(Number(v.pregunta_id)), String(v.valor)));
    porRespuesta.set(Number(v.respuesta_id), mapa);
  }

  const hojas: Hoja[] = [];
  const csv: Hoja = {
    nombre: "Respuestas",
    cabecera: ["Encuesta", "Respuesta N°", "Participante", "Fecha", "Pregunta", "Respuesta"],
    filas: [],
  };
  for (const encuesta of lasEncuestas) {
    const suyas = preguntas.filter((p) => Number(p.encuesta_id) === Number(encuesta.id));
    const filas: Celda[][] = [];
    respuestas
      .filter((r) => Number(r.encuesta_id) === Number(encuesta.id))
      .forEach((r, i) => {
        const dadas = porRespuesta.get(Number(r.id)) ?? new Map<number, string>();
        const fecha = fechaChile(String(r.created_at));
        filas.push([i + 1, String(r.participante), fecha, ...suyas.map((p) => dadas.get(Number(p.id)) ?? "")]);
        for (const p of suyas) {
          if (dadas.has(Number(p.id))) {
            csv.filas.push([encuesta.titulo, i + 1, String(r.participante), fecha, p.texto, dadas.get(Number(p.id)) ?? ""]);
          }
        }
      });
    hojas.push({
      nombre: encuesta.titulo,
      cabecera: ["Respuesta N°", "Participante", "Fecha", ...suyas.map((p) => p.texto)],
      filas,
    });
  }
  if (!hojas.length) hojas.push({ ...csv, nombre: "Encuestas" });
  return { hojas, csv };
}

// --------------------------------------------------------------- votaciones

// Resultados por alternativa y el detalle de cada voto (con nombre y correo
// cuando la votación los pide). El CSV es el detalle.
async function votaciones(eventoId: number): Promise<Exportacion> {
  const lasVotaciones = await consultar<Votacion>(
    "SELECT * FROM votaciones WHERE evento_id = ? ORDER BY orden, id",
    [eventoId]
  );
  const conteo = await consultar<{ votacion_id: number; texto: string; votos: number }>(
    `SELECT o.votacion_id, o.texto, COUNT(v.id) AS votos FROM votacion_opciones o
       JOIN votaciones x ON x.id = o.votacion_id
       LEFT JOIN votos v ON v.opcion_id = o.id
      WHERE x.evento_id = ? GROUP BY o.id ORDER BY o.votacion_id, o.orden, o.id`,
    [eventoId]
  );
  const votos = await consultar<{ votacion_id: number; texto: string; nombre: string; email: string; created_at: string }>(
    `SELECT v.votacion_id, o.texto, v.nombre, v.email, v.created_at FROM votos v
       JOIN votacion_opciones o ON o.id = v.opcion_id
       JOIN votaciones x ON x.id = v.votacion_id
      WHERE x.evento_id = ? ORDER BY v.created_at, v.id`,
    [eventoId]
  );
  const titulo = new Map(lasVotaciones.map((v) => [Number(v.id), v.titulo]));
  const totales = new Map<number, number>();
  for (const c of conteo) totales.set(Number(c.votacion_id), (totales.get(Number(c.votacion_id)) ?? 0) + Number(c.votos));

  const resultados: Hoja = {
    nombre: "Resultados",
    cabecera: ["Votación", "Alternativa", "Votos", "Porcentaje"],
    filas: conteo.map((c) => {
      const total = totales.get(Number(c.votacion_id)) ?? 0;
      const votosOpcion = Number(c.votos);
      return [
        titulo.get(Number(c.votacion_id)) ?? "",
        String(c.texto),
        votosOpcion,
        total ? `${Math.round((votosOpcion / total) * 1000) / 10}%` : "0%",
      ];
    }),
  };
  const detalle: Hoja = {
    nombre: "Votos",
    cabecera: ["Votación", "Eligió", "Nombre", "Correo", "Fecha"],
    filas: votos.map((v) => [
      titulo.get(Number(v.votacion_id)) ?? "",
      String(v.texto),
      String(v.nombre),
      String(v.email),
      fechaChile(String(v.created_at)),
    ]),
  };
  return { hojas: [resultados, detalle], csv: detalle };
}

// ----------------------------------------------------------------- sorteos

function datosDe(r: Resultado, columnas: string[]): string {
  const datos = r.datos ?? {};
  const orden = [...columnas.filter((c) => c in datos), ...Object.keys(datos).filter((c) => !columnas.includes(c))];
  return orden
    .filter((c) => String(datos[c] ?? "").trim())
    .map((c) => `${c}: ${datos[c]}`)
    .join(" · ");
}

// Un resumen por sorteo, quiénes salieron (con los datos de la base para
// contactarlos) y quiénes se inscribieron con el QR. El CSV son los resultados.
async function sorteos(eventoId: number): Promise<Exportacion> {
  const losSorteos = await consultar<Sorteo>(
    "SELECT * FROM sorteos WHERE evento_id = ? ORDER BY id",
    [eventoId]
  );
  const inscritos = await consultar<{ sorteo_id: number; nombre: string; email: string; created_at: string }>(
    `SELECT i.sorteo_id, i.nombre, i.email, i.created_at FROM sorteo_inscritos i
       JOIN sorteos s ON s.id = i.sorteo_id
      WHERE s.evento_id = ? ORDER BY i.sorteo_id, i.created_at, i.id`,
    [eventoId]
  );
  const titulo = new Map(losSorteos.map((s) => [Number(s.id), s.titulo]));

  const resumen: Hoja = {
    nombre: "Sorteos",
    cabecera: ["Sorteo", "Premio", "Participan", "Estado", "Fecha programada", "Realizado", "Personas en el bombo", "Ganadores", "Suplentes"],
    filas: losSorteos.map((s) => [
      s.titulo,
      s.premio,
      FUENTE_SORTEO[s.fuente] ?? s.fuente,
      s.ejecutado_at ? "Realizado" : "Pendiente",
      fechaChile(s.fecha_sorteo),
      fechaChile(s.ejecutado_at),
      s.ejecutado_at ? Number(s.disponibles) || "" : "",
      leerNombres(s.ganadores).join(", "),
      leerNombres(s.suplentes).join(", "),
    ]),
  };

  const resultados: Hoja = {
    nombre: "Resultados",
    cabecera: ["Sorteo", "Premio", "Resultado", "Orden", "Nombre", "Datos", "Realizado"],
    filas: [],
  };
  for (const s of losSorteos) {
    if (!s.ejecutado_at) continue;
    // Sorteos realizados antes de guardar el detalle: solo quedan los nombres.
    let salieron = leerDetalle(s.detalle);
    if (!salieron.length) {
      salieron = [
        ...leerNombres(s.ganadores).map((nombre, i) => ({ nombre, clave: "", suplente: false, orden: i + 1 })),
        ...leerNombres(s.suplentes).map((nombre, i) => ({ nombre, clave: "", suplente: true, orden: i + 1 })),
      ];
    }
    const columnas = leerColumnas(s);
    for (const r of salieron) {
      resultados.filas.push([
        s.titulo,
        s.premio,
        r.suplente ? "Suplente" : "Ganador",
        r.orden,
        r.nombre,
        datosDe(r, columnas),
        fechaChile(s.ejecutado_at),
      ]);
    }
  }

  const hojaInscritos: Hoja = {
    nombre: "Inscritos con QR",
    cabecera: ["Sorteo", "Nombre", "Correo", "Fecha"],
    filas: inscritos.map((i) => [
      titulo.get(Number(i.sorteo_id)) ?? "",
      String(i.nombre),
      String(i.email),
      fechaChile(String(i.created_at)),
    ]),
  };
  return {
    hojas: [resumen, resultados, ...(hojaInscritos.filas.length ? [hojaInscritos] : [])],
    csv: resultados,
  };
}

// ------------------------------------------------------------------ trivia

// Cada partida jugada con su lugar en la tabla de esa trivia: más puntaje
// primero y, si empatan, quien terminó antes.
async function trivia(eventoId: number): Promise<Exportacion> {
  const lasTrivias = await consultar<Trivia>(
    "SELECT * FROM trivias WHERE evento_id = ? ORDER BY orden, id",
    [eventoId]
  );
  const partidas = await consultar<{ trivia_id: number; participante: string; puntaje: number; total: number; created_at: string }>(
    `SELECT p.trivia_id, p.participante, p.puntaje, p.total, p.created_at FROM trivia_partidas p
       JOIN trivias t ON t.id = p.trivia_id
      WHERE t.evento_id = ? ORDER BY p.trivia_id, p.puntaje DESC, p.created_at, p.id`,
    [eventoId]
  );
  const hoja: Hoja = {
    nombre: "Partidas",
    cabecera: ["Trivia", "Lugar", "Participante", "Correctas", "Preguntas", "Acierto", "Fecha"],
    filas: [],
  };
  for (const t of lasTrivias) {
    partidas
      .filter((p) => Number(p.trivia_id) === Number(t.id))
      .forEach((p, i) => {
        const total = Number(p.total);
        const puntaje = Number(p.puntaje);
        hoja.filas.push([
          t.titulo,
          i + 1,
          String(p.participante) || "Sin nombre",
          puntaje,
          total,
          total ? `${Math.round((puntaje / total) * 100)}%` : "",
          fechaChile(String(p.created_at)),
        ]);
      });
  }
  return { hojas: [hoja], csv: hoja };
}

export async function exportarModulo(modulo: ModuloExportable, eventoId: number): Promise<Exportacion> {
  if (modulo === "mensajes") return mensajes(eventoId);
  if (modulo === "encuestas") return encuestas(eventoId);
  if (modulo === "votaciones") return votaciones(eventoId);
  if (modulo === "sorteos") return sorteos(eventoId);
  return trivia(eventoId);
}

// Excel no acepta ciertos caracteres en el nombre de una hoja, ni más de 31
// caracteres, ni dos hojas con el mismo nombre.
function nombreHoja(nombre: string, usados: Set<string>): string {
  const base = nombre.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Hoja";
  let candidato = base;
  for (let n = 2; usados.has(candidato.toLowerCase()); n++) {
    const sufijo = ` (${n})`;
    candidato = `${base.slice(0, 31 - sufijo.length)}${sufijo}`;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

export async function respuestaExportacion(
  exportacion: Exportacion,
  formato: "csv" | "xlsx",
  archivo: string
): Promise<Response> {
  if (formato === "csv") {
    return respuestaCsv([exportacion.csv.cabecera, ...exportacion.csv.filas], `${archivo}.csv`);
  }
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  const usados = new Set<string>();
  for (const datos of exportacion.hojas) {
    const hoja = libro.addWorksheet(nombreHoja(datos.nombre, usados));
    hoja.addRow(datos.cabecera).font = { bold: true };
    for (const fila of datos.filas) hoja.addRow(fila);
    hoja.views = [{ state: "frozen", ySplit: 1 }];
    hoja.columns.forEach((columna, i) => {
      const largo = Math.max(
        datos.cabecera[i]?.length ?? 0,
        ...datos.filas.map((f) => String(f[i] ?? "").length)
      );
      columna.width = Math.min(60, Math.max(10, largo + 2));
      columna.alignment = { vertical: "top", wrapText: largo > 60 };
    });
  }
  const buffer = await libro.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${archivo}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
