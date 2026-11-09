import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { consultar, type Guest } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { COLUMNAS_PLANILLA, EJEMPLO_PLANILLA } from "@/lib/planilla";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// La planilla de participantes con todo lo registrado, incluido su estado. Usa
// los mismos encabezados que la importación: se puede corregir en Excel y
// volver a subir. Sin participantes todavía, sale la plantilla con un ejemplo.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const participantes = await consultar<Guest>(
    "SELECT * FROM guests WHERE evento_id = ? AND eliminado_at = '' ORDER BY nombre COLLATE NOCASE",
    [evento.id]
  );
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Participantes");
  hoja.columns = COLUMNAS_PLANILLA;
  hoja.getRow(1).font = { bold: true };
  if (participantes.length) {
    for (const p of participantes) {
      hoja.addRow({
        nombre: p.nombre,
        telefono: p.telefono,
        email: p.email,
        grupo: p.grupo,
        mesa: p.mesa,
        cupos: Number(p.cupos ?? 1),
        estado: p.estado,
        asistentes: Number(p.asistentes ?? 0),
        nota: p.nota,
        actualizado: p.updated_at,
      });
    }
  } else {
    hoja.addRow(EJEMPLO_PLANILLA);
  }
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="participantes-${evento.slug}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
