import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { del, put } from "@vercel/blob";

export const CARPETA = path.join(process.cwd(), "data", "uploads");
export const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

const EXT_POR_TIPO: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

// Solo se sirven nombres generados por nosotros: 20 hex + extensión conocida.
export const NOMBRE_VALIDO = /^[a-f0-9]{20}\.[a-z]{3,4}$/;

// Con almacenamiento en la nube configurado se sube ahí (es lo que corresponde
// en un servidor sin disco propio); si no, se guarda en data/uploads.
const enLaNube = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export type Guardado = { ok: true; archivo: string } | { ok: false; error: string };

export async function guardarImagen(file: unknown): Promise<Guardado> {
  if (!(file instanceof File)) return { ok: false, error: "falta el archivo" };
  const ext = EXT_POR_TIPO[file.type];
  if (!ext) {
    return { ok: false, error: "formato no soportado (usa JPG, PNG, WebP o HEIC)" };
  }
  if (file.size > MAX_BYTES) return { ok: false, error: "la imagen supera los 15 MB" };

  const nombre = crypto.randomBytes(10).toString("hex") + ext;

  if (enLaNube()) {
    const subido = await put(`matrimonios/${nombre}`, file, {
      access: "public",
      contentType: file.type,
    });
    return { ok: true, archivo: subido.url };
  }

  await fs.mkdir(CARPETA, { recursive: true });
  await fs.writeFile(path.join(CARPETA, nombre), Buffer.from(await file.arrayBuffer()));
  return { ok: true, archivo: nombre };
}

export async function borrarArchivo(valor: string) {
  if (!valor) return;
  if (valor.startsWith("http")) {
    if (enLaNube()) await del(valor).catch(() => {});
    return;
  }
  if (NOMBRE_VALIDO.test(valor)) {
    await fs.rm(path.join(CARPETA, valor), { force: true }).catch(() => {});
  }
}
