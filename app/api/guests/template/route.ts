import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { isAdmin, noAutorizado } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return noAutorizado();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Invitados");
  sheet.columns = [
    { header: "Nombre", key: "nombre", width: 30 },
    { header: "Telefono", key: "telefono", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "Grupo", key: "grupo", width: 20 },
    { header: "Mesa", key: "mesa", width: 10 },
    { header: "Cupos", key: "cupos", width: 8 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    nombre: "Ej: María Pérez",
    telefono: "+56 9 1234 5678",
    email: "maria@ejemplo.com",
    grupo: "Familia novia",
    mesa: "1",
    cupos: 2,
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-invitados.xlsx"',
    },
  });
}
