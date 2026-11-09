// Puro y sin dependencias: lo usan tanto el servidor como el navegador.
//
// Una imagen guardada puede ser una URL del almacenamiento en la nube, una
// ruta de /public o el nombre de un archivo en disco (modo desarrollo).
export function urlArchivo(valor: string): string {
  if (!valor) return "";
  if (valor.startsWith("http") || valor.startsWith("/")) return valor;
  return `/api/archivos/${valor}`;
}

/** La pantalla solo recibe archivos aprobados y su propia clave de acceso. */
export function urlFotoPantalla(archivo: string, slug: string, clave: string): string {
  const url = urlArchivo(archivo);
  if (!url.startsWith("/api/archivos/")) return url;
  return `${url}?${new URLSearchParams({ evento: slug, k: clave })}`;
}

/** Lo que devuelve /api/archivos al subir una imagen: veinte hex y la extensión. */
export function archivoSubido(valor: unknown): string {
  const v = typeof valor === "string" ? valor.trim() : "";
  return /^[a-f0-9]{20}\.[a-z]{3,4}$/.test(v) ? v : "";
}
