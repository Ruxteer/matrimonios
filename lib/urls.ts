// Puro y sin dependencias: lo usan tanto el servidor como el navegador.
//
// Una imagen guardada puede ser una URL del almacenamiento en la nube, una
// ruta de /public o el nombre de un archivo en disco (modo desarrollo).
export function urlArchivo(valor: string): string {
  if (!valor) return "";
  if (valor.startsWith("http") || valor.startsWith("/")) return valor;
  return `/api/archivos/${valor}`;
}
