import { NextRequest, NextResponse } from "next/server";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { registroConfig } from "@/lib/registro";
import {
  establecerCookieRegistro, evidenciaConsentimiento, fotosDeParticipante, guardarRegistro, listarParticipantes,
  participanteActual, participantePublico, type Participante,
} from "@/lib/registro-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };
const sinCache = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "No existe el evento." }, { status: 404 });
  const formato = req.nextUrl.searchParams.get("formato");
  if (req.nextUrl.searchParams.get("admin") === "1" || formato) {
    if (!puedeAdministrar(req, evento)) return noAutorizado();
    if (formato) {
      if (formato !== "csv" && formato !== "xlsx") return NextResponse.json({ error: "Formato no válido." }, { status: 400 });
      const filas = await consultar<Participante & { fotos: number }>(`SELECT participantes.*,
        (SELECT COUNT(*) FROM photos WHERE photos.evento_id = participantes.evento_id AND photos.participante_id = participantes.id) AS fotos
        FROM participantes WHERE evento_id = ? ORDER BY created_at, id`, [evento.id]);
      const campos = new Map(registroConfig(evento).campos_extra.map((campo) => [campo.id, campo.label]));
      for (const fila of filas) {
        for (const id of Object.keys(participantePublico(fila).campos_extra)) {
          if (!campos.has(id)) campos.set(id, id);
        }
      }
      const ids = [...campos.keys()];
      const cabecera = ["Nombre", "Correo", "Teléfono", "Acepta términos y privacidad", "Información y fotos", "Marketing", "Fecha consentimiento", "Fecha registro", "Fotos",
        "Texto aceptado", "Términos aceptados (URL)", "Privacidad aceptada (URL)", "Texto información y fotos", "Texto marketing", ...campos.values()];
      const tabla = filas.map((fila) => {
        const p = participantePublico(fila);
        const evidencia = evidenciaConsentimiento(fila);
        return [p.nombre, p.email, p.telefono, p.consentimiento_legal ? "Sí" : "No", p.consentimiento_informacion ? "Sí" : "No", p.consentimiento_marketing ? "Sí" : "No", p.consentimientos_at, p.created_at, fila.fotos,
          evidencia.consentimiento_texto, evidencia.terminos_url, evidencia.privacidad_url, evidencia.informacion_texto, evidencia.marketing_texto,
          ...ids.map((id) => p.campos_extra[id] ?? "")];
      });
      const descarga = { ...sinCache, "Content-Disposition": `attachment; filename="participantes-${evento.slug}.${formato}"` };
      if (formato === "csv") {
        // Evita que los datos aportados por un invitado ejecuten fórmulas en Excel.
        const celda = (valor: string | number) => {
          const texto = String(valor);
          const seguro = /^[\s]*[=+@-]|^[\t\r\n]/.test(texto) ? `'${texto}` : texto;
          return `"${seguro.replace(/"/g, '""')}"`;
        };
        const csv = "\uFEFF" + [cabecera, ...tabla].map((fila) => fila.map(celda).join(",")).join("\r\n");
        return new NextResponse(csv, { headers: { ...descarga, "Content-Type": "text/csv; charset=utf-8" } });
      }
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();
      const hoja = libro.addWorksheet("Participantes");
      hoja.addRow(cabecera);
      tabla.forEach((fila) => hoja.addRow(fila));
      hoja.getRow(1).font = { bold: true };
      hoja.views = [{ state: "frozen", ySplit: 1 }];
      hoja.columns.forEach((columna) => { columna.width = 26; });
      const archivo = await libro.xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(archivo), { headers: { ...descarga, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
    }
    const pagina = Number(req.nextUrl.searchParams.get("pagina") ?? 1);
    return NextResponse.json(await listarParticipantes(evento, pagina, req.nextUrl.searchParams.get("buscar") ?? ""), { headers: sinCache });
  }
  if (!moduloActivo(evento, "registro")) return NextResponse.json({ error: "Registro no disponible." }, { status: 404 });
  const participante = await participanteActual(req, evento);
  return NextResponse.json({ participante: participante ? participantePublico(participante) : null, fotos: participante ? await fotosDeParticipante(evento, participante) : 0 }, { headers: sinCache });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "registro")) return NextResponse.json({ error: "Registro no disponible." }, { status: 404 });
  if (Number(req.headers.get("content-length") ?? 0) > 20000) return NextResponse.json({ error: "El formulario es demasiado extenso." }, { status: 413 });
  const body = await req.json().catch(() => null);
  const resultado = await guardarRegistro(req, evento, body);
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status, headers: sinCache });
  const respuesta = NextResponse.json({ ok: true, participante: participantePublico(resultado.participante), fotos: await fotosDeParticipante(evento, resultado.participante) }, { status: resultado.nuevo ? 201 : 200, headers: sinCache });
  if (resultado.token) establecerCookieRegistro(respuesta, evento, resultado.token);
  return respuesta;
}
