// Planillas CSV que baja el panel (votantes, inscritos). Punto y coma porque
// es lo que espera Excel en Chile, y el BOM para que lea bien las tildes.

/** Una celda entre comillas y sin que una fórmula se ejecute al abrirla en Excel. */
export function celdaCsv(valor: unknown): string {
  const texto = String(valor ?? "");
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

export function respuestaCsv(filas: unknown[][], archivo: string): Response {
  const lineas = filas.map((fila) => fila.map(celdaCsv).join(";"));
  return new Response(`﻿${lineas.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
