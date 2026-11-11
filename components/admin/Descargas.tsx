"use client";

import { useState } from "react";
import type { ModuloExportable } from "@/lib/exportar";

// Los mismos botones que la descarga del Registro: Excel y CSV del módulo
// completo: todos sus mensajes, encuestas, votaciones, sorteos o trivias.
export default function Descargas({ slug, modulo }: { slug: string; modulo: ModuloExportable }) {
  const [exportando, setExportando] = useState<"" | "csv" | "xlsx">("");
  const [error, setError] = useState("");

  async function exportar(formato: "csv" | "xlsx") {
    setExportando(formato);
    setError("");
    try {
      const res = await fetch(`/api/eventos/${encodeURIComponent(slug)}/exportar/${modulo}?formato=${formato}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "No pudimos preparar la descarga.");
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${modulo}-${slug}.${formato}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos preparar la descarga.");
    } finally {
      setExportando("");
    }
  }

  const boton = "rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => exportar("xlsx")} disabled={Boolean(exportando)} className={boton}>
          {exportando === "xlsx" ? "Exportando…" : "Descargar Excel"}
        </button>
        <button type="button" onClick={() => exportar("csv")} disabled={Boolean(exportando)} className={boton}>
          {exportando === "csv" ? "Exportando…" : "Descargar CSV"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
