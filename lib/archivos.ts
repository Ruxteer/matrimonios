import crypto from "crypto";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { del, get, put } from "@vercel/blob";
import { firmaImagenValida } from "./imagen";

export const CARPETA = path.join(process.cwd(), "data", "uploads");
export const MAX_BYTES = 4 * 1024 * 1024; // deja margen para el cuerpo multipart
const PREFIJO = "matrimonios/";

const EXT_POR_TIPO: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

const TIPO_POR_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

// Solo se sirven nombres generados por nosotros: 20 hex + extensión conocida.
export const NOMBRE_VALIDO = /^[a-f0-9]{20}\.[a-z]{3,4}$/;

// En un servidor sin disco propio las imágenes van al almacenamiento en la
// nube; en desarrollo quedan en data/uploads.
const enLaNube = () =>
  Boolean(
    process.env.VERCEL ||
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID
  );

export type Guardado = { ok: true; archivo: string } | { ok: false; error: string };

// Se guarda solo el nombre del archivo (no una URL): así el mismo dato sirve
// para los dos modos y siempre se entrega por /api/archivos/<nombre>.
export async function guardarImagen(file: unknown): Promise<Guardado> {
  if (!(file instanceof File)) return { ok: false, error: "falta el archivo" };
  const ext = EXT_POR_TIPO[file.type];
  if (!ext) {
    return { ok: false, error: "formato no soportado (usa JPG, PNG, WebP o HEIC)" };
  }
  if (file.size > MAX_BYTES) return { ok: false, error: "la imagen supera los 4 MB" };
  if (file.size === 0) return { ok: false, error: "el archivo está vacío" };
  const cabecera = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (!firmaImagenValida(cabecera, file.type)) {
    return { ok: false, error: "el contenido del archivo no corresponde a una imagen válida" };
  }

  const nombre = crypto.randomBytes(10).toString("hex") + ext;

  if (enLaNube()) {
    await put(PREFIJO + nombre, file, { access: "private", contentType: file.type });
    return { ok: true, archivo: nombre };
  }

  await fs.mkdir(CARPETA, { recursive: true });
  await fs.writeFile(path.join(CARPETA, nombre), Buffer.from(await file.arrayBuffer()));
  return { ok: true, archivo: nombre };
}

// Devuelve el contenido de una imagen para que la sirva /api/archivos.
export async function leerImagen(
  nombre: string
): Promise<{ cuerpo: ReadableStream | Uint8Array; tipo: string } | null> {
  if (!NOMBRE_VALIDO.test(nombre)) return null;
  const tipo = TIPO_POR_EXT[path.extname(nombre)] ?? "application/octet-stream";

  if (enLaNube()) {
    const r = await get(PREFIJO + nombre, { access: "private" });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return { cuerpo: r.stream as ReadableStream, tipo: r.blob.contentType || tipo };
  }

  try {
    const ruta = path.join(CARPETA, nombre);
    await fs.access(ruta);
    return { cuerpo: Readable.toWeb(createReadStream(ruta)) as ReadableStream, tipo };
  } catch {
    return null;
  }
}

export async function borrarArchivo(valor: string) {
  if (!valor || valor.startsWith("/")) return; // rutas de /public no se tocan
  if (valor.startsWith("http")) {
    await del(valor).catch(() => {});
    return;
  }
  if (!NOMBRE_VALIDO.test(valor)) return;
  if (enLaNube()) {
    await del(PREFIJO + valor).catch(() => {});
    return;
  }
  await fs.rm(path.join(CARPETA, valor), { force: true }).catch(() => {});
}
