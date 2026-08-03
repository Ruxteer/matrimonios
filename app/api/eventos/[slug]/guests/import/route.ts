import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { consultar, db, newToken } from "@/lib/db";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

// Encabezados aceptados (se normalizan sin tildes y en minúsculas)
const HEADER_MAP: Record<string, string> = {
  "nombre completo": "nombre_completo",
  nombre: "nombre",
  invitado: "nombre",
  apellido: "apellido",
  telefono: "telefono",
  fono: "telefono",
  celular: "telefono",
  email: "email",
  correo: "email",
  mail: "email",
  grupo: "grupo",
  familia: "grupo",
  mesa: "mesa",
  "mesa asignada": "mesa",
  estado: "estado",
  "estado invitacion": "estado",
  cupos: "cupos",
  acompanantes: "cupos",
  invitados: "cupos",
};

function normalize(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
  }
  return String(v).trim();
}

function parseEstado(v: string): "pendiente" | "confirmado" | "rechazado" {
  const n = normalize(v);
  if (n.startsWith("confirm")) return "confirmado";
  if (n.startsWith("rechaz") || n.startsWith("no ")) return "rechazado";
  return "pendiente";
}

// Busca la fila de encabezados dentro de las primeras 10 filas
// (algunas planillas traen una fila de título antes).
function findHeader(sheet: ExcelJS.Worksheet): {
  headerRow: number;
  columns: Record<number, string>;
} | null {
  for (let r = 1; r <= Math.min(sheet.rowCount, 10); r++) {
    const columns: Record<number, string> = {};
    sheet.getRow(r).eachCell((cell, colNumber) => {
      const field = HEADER_MAP[normalize(cell.value)];
      if (field && !Object.values(columns).includes(field)) {
        columns[colNumber] = field;
      }
    });
    const fields = Object.values(columns);
    if (fields.includes("nombre") || fields.includes("nombre_completo")) {
      return { headerRow: r, columns };
    }
  }
  return null;
}

type Fila = {
  nombre: string;
  telefono: string;
  email: string;
  grupo: string;
  mesa: string;
  cupos: number;
  estado: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "sube un archivo .xlsx en el campo 'file'" },
      { status: 400 }
    );
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "el archivo no es un .xlsx válido" }, { status: 400 });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return NextResponse.json({ error: "la planilla está vacía" }, { status: 400 });
  }

  const header = findHeader(sheet);
  if (!header) {
    return NextResponse.json(
      { error: "no encontré una columna 'Nombre' o 'Nombre completo' en las primeras filas" },
      { status: 400 }
    );
  }

  // Una sola pasada por la planilla. Si un nombre viene repetido, vale la
  // última fila (igual que cuando se procesaba fila por fila).
  const porNombre = new Map<string, Fila>();
  for (let r = header.headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const data: Record<string, string> = {};
    for (const [col, field] of Object.entries(header.columns)) {
      data[field] = cellText(row.getCell(Number(col)).value);
    }
    const nombre =
      data.nombre_completo || [data.nombre, data.apellido].filter(Boolean).join(" ");
    if (!nombre) continue; // fila vacía
    porNombre.set(nombre.toLowerCase(), {
      nombre,
      telefono: data.telefono ?? "",
      email: data.email ?? "",
      grupo: data.grupo ?? "",
      mesa: data.mesa ?? "",
      cupos: Number(data.cupos) || 1,
      estado: parseEstado(data.estado ?? ""),
    });
  }

  // Los invitados que ya están se piden de una vez: así la importación son
  // dos viajes a la base y no uno por fila.
  const existentes = await consultar<{ id: number; nombre: string }>(
    "SELECT id, nombre FROM guests WHERE evento_id = ?",
    [evento.id]
  );
  const idPorNombre = new Map(existentes.map((g) => [g.nombre.toLowerCase(), g.id]));

  const sentencias = [];
  let created = 0;
  let updated = 0;

  for (const [clave, f] of porNombre) {
    const id = idPorNombre.get(clave);
    if (id) {
      sentencias.push({
        sql: `UPDATE guests SET telefono=?, email=?, grupo=?, mesa=?, cupos=?, estado=?,
              updated_at=datetime('now') WHERE id=?`,
        args: [f.telefono, f.email, f.grupo, f.mesa, f.cupos, f.estado, id],
      });
      updated++;
    } else {
      sentencias.push({
        sql: `INSERT INTO guests (evento_id, nombre, telefono, email, grupo, mesa, cupos, estado, token)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          evento.id,
          f.nombre,
          f.telefono,
          f.email,
          f.grupo,
          f.mesa,
          f.cupos,
          f.estado,
          newToken(),
        ],
      });
      created++;
    }
  }

  const errors: string[] = [];
  if (sentencias.length) {
    try {
      const c = await db();
      await c.batch(sentencias, "write");
    } catch (e) {
      return NextResponse.json(
        { error: `no pudimos guardar la lista: ${e instanceof Error ? e.message : e}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ created, updated, errors });
}
