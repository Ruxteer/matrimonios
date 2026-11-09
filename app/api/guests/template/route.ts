import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";
import { eventoDeSesion } from "@/lib/eventos";
import { COLUMNAS_PLANILLA, EJEMPLO_PLANILLA } from "@/lib/planilla";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vale la clave maestra o la de cualquier matrimonio: sus novios también
  // suben imágenes y bajan la planilla.
  if (!isAdmin(req) && !(await eventoDeSesion(req))) return noAutorizado();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Participantes");
  sheet.columns = COLUMNAS_PLANILLA;
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(EJEMPLO_PLANILLA);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-participantes.xlsx"',
    },
  });
}
