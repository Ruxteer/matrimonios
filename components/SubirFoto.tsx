"use client";

import { useRef, useState } from "react";
import { BotonRosa } from "./ui";

export default function SubirFoto({ slug }: { slug: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");

  function elegir(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setListo(false);
    setError("");
    const url = URL.createObjectURL(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
  }

  async function subir() {
    if (!file) return;
    setSubiendo(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/eventos/${slug}/photos`, { method: "POST", body: form });
    setSubiendo(false);
    if (res.ok) {
      setListo(true);
      setFile(null);
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No pudimos subir la foto. Intenta de nuevo.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[259px] rounded-[20px] bg-gris-card px-[15px] py-4 shadow-sm">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => elegir(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mb-4 flex min-h-36 w-full items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-neutral-400 bg-white px-5 text-center text-[13px]"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Foto elegida" className="max-h-64 w-full object-contain" />
        ) : (
          <>
            Toca para seleccionar la
            <br /> foto o para tomar una foto
          </>
        )}
      </button>

      <p className="mb-2 pl-1 font-serif text-sm font-bold">Tu foto será parte de:</p>
      <ul className="mb-4 space-y-1 pl-2 text-[13px]">
        <li>•&ensp;Galería del evento</li>
        <li>•&ensp;Pantallas en vivo</li>
        <li>•&ensp;Recuerdos digitales</li>
      </ul>

      {listo && (
        <p className="mb-3 text-center font-serif font-bold">
          ¡Foto subida! Puedes compartir otra si quieres.
        </p>
      )}
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {file ? (
        <BotonRosa onClick={subir} disabled={subiendo}>
          {subiendo ? "Subiendo…" : "Subir esta foto"}
        </BotonRosa>
      ) : (
        <BotonRosa onClick={() => fileRef.current?.click()}>Seleccionar foto</BotonRosa>
      )}
    </div>
  );
}
