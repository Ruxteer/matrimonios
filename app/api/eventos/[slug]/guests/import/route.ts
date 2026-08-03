import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db, newToken } from "@/lib/db";
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAdmin(req)) return noAutorizado();
  const { slug } = await params;
  const evento = getEvento(slug);
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

  const insert = db().prepare(
    `INSERT INTO guests (evento_id, nombre, telefono, email, grupo, mesa, cupos, estado, token)
     VALUES (@evento_id, @nombre, @telefono, @email, @grupo, @mesa, @cupos, @estado, @token)`
  );
  const update = db().prepare(
    `UPDATE guests SET telefono=@telefono, email=@email, grupo=@grupo, mesa=@mesa,
     cupos=@cupos, estado=@estado, updated_at=datetime('now') WHERE id=@id`
  );
  const findByName = db().prepare(
    "SELECT id FROM guests WHERE evento_id = ? AND nombre = ? COLLATE NOCASE"
  );

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  const tx = db().transaction(() => {
    for (let r = header.headerRow + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const data: Record<string, string> = {};
      for (const [col, field] of Object.entries(header.columns)) {
        data[field] = cellText(row.getCell(Number(col)).value);
      }
      const nombre =
        data.nombre_completo || [data.nombre, data.apellido].filter(Boolean).join(" ");
      if (!nombre) continue; // fila vacía
      const record = {
        evento_id: evento.id,
        nombre,
        telefono: data.telefono ?? "",
        email: data.email ?? "",
        grupo: data.grupo ?? "",
        mesa: data.mesa ?? "",
        cupos: Number(data.cupos) || 1,
        estado: parseEstado(data.estado ?? ""),
      };
      try {
        const existing = findByName.get(evento.id, record.nombre) as
          | { id: number }
          | undefined;
        if (existing) {
          update.run({ ...record, id: existing.id });
          updated++;
        } else {
          insert.run({ ...record, token: newToken() });
          created++;
        }
      } catch (e) {
        errors.push(`fila ${r}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });
  tx();

  return NextResponse.json({ created, updated, errors });
}
