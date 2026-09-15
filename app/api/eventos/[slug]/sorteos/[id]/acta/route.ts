import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { uno, type Sorteo } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento, nombreEvento, slugify } from "@/lib/eventos";
import { leerColumnas, leerDetalle, leerNombres, type Resultado } from "@/lib/sorteos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const FUENTE: Record<string, string> = {
  invitados: "Todos los invitados",
  mensajes: "Quienes dejaron un mensaje",
  lista: "Lista escrita en el panel",
  base: "Base importada",
};

// ejecutado_at viene de SQLite en UTC; el acta va en hora de Chile.
function horaChile(utc: string): string {
  if (!utc) return "";
  return new Date(`${utc.replace(" ", "T")}Z`).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "long",
    timeStyle: "medium",
  });
}

// Acta del sorteo: qué se sorteó, cuándo, entre cuántos y quiénes salieron,
// con todas las columnas que traía la base para poder contactarlos. Es el
// registro de evidencia que pide el módulo; solo lo baja quien administra.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (!sorteo) return NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 });
  if (!sorteo.ejecutado_at) {
    return NextResponse.json({ error: "El sorteo todavía no se ejecuta." }, { status: 400 });
  }

  // Sorteos ejecutados antes de guardar el detalle: solo quedan los nombres.
  let resultados: Resultado[] = leerDetalle(sorteo.detalle);
  if (!resultados.length) {
    resultados = leerNombres(sorteo.ganadores).map((nombre, i) => ({
      nombre,
      clave: "",
      suplente: false,
      orden: i + 1,
    }));
  }

  // Las columnas extra, en el orden de la base; si no hay base, las que traiga
  // el detalle (por ejemplo mesa y grupo de los invitados).
  const extra = leerColumnas(sorteo);
  for (const r of resultados) {
    for (const col of Object.keys(r.datos ?? {})) if (!extra.includes(col)) extra.push(col);
  }

  const encabezado = ["Resultado", "Orden", "Nombre", ...extra];
  const filas = resultados.map((r) => [
    r.suplente ? "Suplente" : "Ganador",
    r.orden,
    r.nombre,
    ...extra.map((col) => r.datos?.[col] ?? ""),
  ]);
  const archivo = `acta-${slugify(sorteo.titulo) || "sorteo"}`;

  if (req.nextUrl.searchParams.get("formato") === "csv") {
    // Punto y coma y BOM: así lo abre bien el Excel configurado en español.
    const celda = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [encabezado, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
    return new Response(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${archivo}.csv"`,
      },
    });
  }

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Acta");
  const ficha: [string, string | number][] = [
    ["Evento", nombreEvento(evento)],
    ["Sorteo", sorteo.titulo],
    ["Premio", sorteo.premio || "—"],
    ["Participantes", FUENTE[sorteo.fuente] ?? sorteo.fuente],
    ...(sorteo.base_nombre ? [["Archivo", sorteo.base_nombre] as [string, string]] : []),
    ["Personas en el bombo", sorteo.disponibles || "—"],
    ["Ganadores anteriores", sorteo.excluir_anteriores ? "Excluidos" : "Podían volver a ganar"],
    ["Ejecutado", horaChile(sorteo.ejecutado_at)],
    ["Método", "Selección aleatoria con generador criptográfico (crypto.randomInt, Fisher-Yates)"],
  ];
  hoja.addRow(["Acta de sorteo"]).font = { bold: true, size: 14 };
  hoja.addRow([]);
  for (const [dato, valor] of ficha) {
    const fila = hoja.addRow([dato, valor]);
    fila.getCell(1).font = { bold: true };
  }
  hoja.addRow([]);
  const cabecera = hoja.addRow(encabezado);
  cabecera.font = { bold: true };
  cabecera.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEEEE" } };
  });
  for (const fila of filas) hoja.addRow(fila);
  hoja.columns.forEach((col, i) => {
    col.width = i === 0 ? 24 : i === 2 ? 32 : i === 1 ? 10 : 22;
  });

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${archivo}.xlsx"`,
    },
  });
}
