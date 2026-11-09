"use client";

import { useRef, useState } from "react";
import { urlArchivo } from "@/lib/urls";

/** Sube una imagen del panel y devuelve su nombre de archivo. */
export async function subirImagen(file: File): Promise<string> {
  const datos = new FormData();
  datos.append("file", file);
  const res = await fetch("/api/archivos", { method: "POST", body: datos });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "No pudimos subir la imagen.");
  return data.archivo as string;
}

// Una imagen opcional: miniatura con sus botones para subir, cambiar o quitar.
// `onCambio` recibe el archivo nuevo ("" al quitar) y se encarga de guardarlo:
// una imagen subida y no guardada queda sin dueño en el almacenamiento.
export default function CampoImagen({
  valor,
  onCambio,
  etiqueta = "Foto",
  compacto = false,
  className = "",
}: {
  valor: string;
  onCambio: (archivo: string) => Promise<void> | void;
  etiqueta?: string;
  compacto?: boolean;
  className?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function elegir(file: File) {
    setSubiendo(true);
    setError("");
    try {
      await onCambio(await subirImagen(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  const tamano = compacto ? "h-14 w-14" : "h-20 w-28";
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={subiendo}
        aria-label={valor ? `Cambiar ${etiqueta.toLowerCase()}` : `Subir ${etiqueta.toLowerCase()}`}
        className={`${tamano} shrink-0 overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400 hover:border-neutral-500`}
      >
        {valor ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlArchivo(valor)} alt="" className="h-full w-full object-cover" />
        ) : subiendo ? (
          "Subiendo…"
        ) : (
          "+ Foto"
        )}
      </button>
      {!compacto && (
        <div className="text-sm">
          <p className="text-neutral-500">{etiqueta} (opcional)</p>
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              disabled={subiendo}
              className="underline hover:text-neutral-950 disabled:opacity-50"
            >
              {subiendo ? "Subiendo…" : valor ? "Cambiar" : "Subir foto"}
            </button>
            {valor && (
              <button
                type="button"
                onClick={() => onCambio("")}
                disabled={subiendo}
                className="text-neutral-400 hover:text-rose-600"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      )}
      {compacto && valor && (
        <button
          type="button"
          onClick={() => onCambio("")}
          title={`Quitar ${etiqueta.toLowerCase()}`}
          aria-label={`Quitar ${etiqueta.toLowerCase()}`}
          className="text-xs text-neutral-400 hover:text-rose-600"
        >
          Quitar
        </button>
      )}
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) elegir(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
