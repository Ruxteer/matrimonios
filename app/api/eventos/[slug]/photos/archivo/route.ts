import { Readable } from "stream";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { leerImagen } from "@/lib/archivos";
import { getEvento } from "@/lib/eventos";
import { listarFotos } from "@/lib/fotos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const fotos = await listarFotos(evento.id);
  if (!fotos.length) return NextResponse.json({ error: "Todavía no hay fotos para descargar." }, { status: 404 });
  const zip = new JSZip();
  const fuentes: Readable[] = [];
  const celda = (valor: string | number) => {
    const texto = String(valor);
    const seguro = /^[\s]*[=+@-]/.test(texto) ? `'${texto}` : texto;
    return `"${seguro.replace(/"/g, '""')}"`;
  };
  const manifest = [["Archivo", "ID foto", "Participante", "Email", "Estado", "Fecha"].map(celda).join(",")];
  for (const foto of fotos) {
    const nombre = foto.participante_nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "sin-registro";
    const extension = foto.archivo.split(".").pop() || "jpg";
    // El archivo se abre al consumir su entrada, sin cargar el ZIP en memoria.
    const fuente = Readable.from((async function* () {
      const imagen = await leerImagen(foto.archivo);
      if (!imagen) throw new Error(`No se encuentra la foto ${foto.id}`);
      if (imagen.cuerpo instanceof Uint8Array) yield imagen.cuerpo;
      else {
        const lector = imagen.cuerpo.getReader();
        try {
          for (;;) {
            const parte = await lector.read();
            if (parte.done) break;
            yield parte.value;
          }
        } finally {
          await lector.cancel();
          lector.releaseLock();
        }
      }
    })());
    fuentes.push(fuente);
    const ruta = `fotos/${String(foto.id).padStart(6, "0")}-${foto.estado}-${nombre}.${extension}`;
    zip.file(ruta, fuente);
    manifest.push([ruta, foto.id, foto.participante_nombre, foto.participante_email, foto.estado, foto.created_at].map(celda).join(","));
  }
  zip.file("fotos.csv", "\uFEFF" + manifest.join("\r\n"));
  const salida = new Readable({ read() {} }).wrap(zip.generateNodeStream({ streamFiles: true, compression: "STORE" }));
  req.signal.addEventListener("abort", () => {
    salida.destroy();
    for (const fuente of fuentes) fuente.destroy();
  }, { once: true });
  return new Response(Readable.toWeb(salida) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${evento.slug}-fotos.zip"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
