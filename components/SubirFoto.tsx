"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { BotonRosa } from "./ui";

function AccionFoto({ activacion, children, href, className = "", ...props }: ComponentProps<typeof BotonRosa> & { activacion: boolean }) {
  if (!activacion) return <BotonRosa href={href} className={className} {...props}>{children}</BotonRosa>;
  const clases = `flex min-h-12 w-full items-center justify-center gap-4 rounded-full bg-rosa px-5 py-3 text-center text-sm font-semibold text-rosa-texto transition hover:brightness-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rosa ${className}`;
  const contenido = <>{children}<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></>;
  if (href) return <Link href={href} className={clases}>{contenido}</Link>;
  return <button {...props} type={props.type ?? "button"} className={clases}>{contenido}</button>;
}

function DetalleFotos({ moderacion }: { moderacion: boolean }) {
  const filas = [
    { tipo: "imagen", texto: "Recuerdos del evento" },
    { tipo: "pantalla", texto: moderacion ? "Pantalla en vivo, al aprobarse" : "Tu foto en pantalla" },
    { tipo: "archivo", texto: "Archivo de fotografías" },
  ];
  return (
    <div className="mb-4 rounded-[16px] bg-rosa/8 px-4 py-3">
      <p className="mb-1 text-[14px] font-extrabold">Tu foto será parte de:</p>
      {filas.map(({ tipo, texto }) => (
        <div key={tipo} className="flex min-h-10 items-center gap-3 border-b border-rosa/10 py-1.5 last:border-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rosa/12">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
              {tipo === "imagen" && <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m3 18 6-7 5 5 3-3 4 5" /></>}
              {tipo === "pantalla" && <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" /></>}
              {tipo === "archivo" && <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6" /></>}
            </svg>
          </span>
          <span className="text-[12px] leading-snug text-foreground/65">{texto}</span>
        </div>
      ))}
    </div>
  );
}

type Props = {
  slug: string;
  participanteNombre: string | null;
  requiereRegistro: boolean;
  maxFotos: number;
  fotosUsadas: number;
  moderacion: boolean;
  activacion?: boolean;
  /** Título propio del evento; sin él, la activación usa "Comparte / TU FOTO". */
  titulo?: string;
};

export default function SubirFoto({ slug, participanteNombre, requiereRegistro, maxFotos, fotosUsadas, moderacion, activacion = false, titulo }: Props) {
  const archivoRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [listo, setListo] = useState<"pendiente" | "aprobada" | null>(null);
  const [error, setError] = useState("");
  const [restantes, setRestantes] = useState<number | null>(participanteNombre ? Math.max(0, maxFotos - fotosUsadas) : null);
  const [registroNecesario, setRegistroNecesario] = useState(requiereRegistro && !participanteNombre);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  function elegir(f: File | undefined) {
    if (!f || subiendo) return;
    setError("");
    setListo(null);
    setFile(null);
    setPreview(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)) {
      setError("Elige JPG, PNG, WebP o GIF. Exporta las fotos HEIC como JPG para compartirlas.");
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      setError("La foto supera los 4 MB. Elige una versión más pequeña.");
      return;
    }
    const url = URL.createObjectURL(f);
    urlRef.current = url;
    setPreview(url);
    setFile(f);
  }

  async function subir() {
    if (!file || subiendo) return;
    setSubiendo(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/eventos/${slug}/photos`, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.registro_requerido) setRegistroNecesario(true);
        if (data?.limite_alcanzado) setRestantes(0);
        setError(data?.error ?? "No pudimos subir la foto. Intenta de nuevo.");
        return;
      }
      setListo(data?.estado === "aprobada" ? "aprobada" : "pendiente");
      setFile(null);
      if (typeof data?.restantes === "number") setRestantes(data.restantes);
    } catch {
      setError("No pudimos conectar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  const foco = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rosa";
  const card = activacion ? "event-card activation-photo mx-auto w-full max-w-[420px] rounded-[24px] bg-gris-card p-6 font-sans text-foreground" : "mx-auto w-full max-w-sm rounded-2xl bg-gris-card p-5 shadow-sm";
  const secundario = activacion ? `min-h-11 rounded-full border border-rosa/20 px-4 text-[13px] font-medium text-rosa disabled:opacity-50 ${foco}` : `min-h-11 rounded-lg border border-current/20 bg-white/70 px-3 text-sm font-medium disabled:opacity-50 ${foco}`;
  return (
    <section className={card} aria-label="Compartir una foto" aria-busy={subiendo}>
      {activacion && (
        <header className="mb-4 text-center">
          {titulo ? (
            <h2 className="activation-heading mb-2 text-[30px] font-black leading-[1.05] tracking-[-0.04em] [text-wrap:balance]">{titulo}</h2>
          ) : (
            <>
              <h2 className="activation-heading text-[36px] font-black leading-[1.05] tracking-[-0.045em]">Comparte</h2>
              <p className="activation-subtitle mb-2 mt-1 text-[16px] font-bold tracking-[0.3em] text-rosa">TU FOTO</p>
            </>
          )}
          <p className="mx-auto max-w-[285px] text-[13px] leading-[1.45] text-foreground/65">Súbela desde tu celular o tómala en este momento y comparte tu experiencia.</p>
        </header>
      )}
      {registroNecesario ? (
        <div className="space-y-4 text-center">
          <p className={activacion ? "text-sm font-bold" : "font-semibold"}>Tu foto tiene tu nombre</p>
          <p className="text-sm leading-relaxed opacity-80">Completa el registro del evento para compartir tus momentos.</p>
          <AccionFoto activacion={activacion} href={`/${slug}/registro`} className={foco}>Registrarme para subir mi foto</AccionFoto>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        </div>
      ) : (
        <>
          {participanteNombre && !activacion && (
            <div className="mb-4 border-b border-current/10 pb-3">
              <p className="text-sm font-semibold">Hola, {participanteNombre}</p>
              <p className="mt-1 text-xs opacity-70">{maxFotos === 1 ? "Una foto por participante" : `Hasta ${maxFotos} fotos por participante`}{restantes !== null && ` · ${restantes} ${restantes === 1 ? "disponible" : "disponibles"}`}</p>
            </div>
          )}
          <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" aria-label="Seleccionar una foto" disabled={subiendo || restantes === 0} onChange={(e) => { elegir(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Tomar una foto" disabled={subiendo || restantes === 0} onChange={(e) => { elegir(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          {preview ? (
            <div className="mb-4 overflow-hidden rounded-[14px] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={listo ? "Foto compartida" : "Vista previa de la foto elegida"} className="max-h-80 w-full object-contain" />
            </div>
          ) : (
            <button type="button" onClick={() => archivoRef.current?.click()} disabled={subiendo || restantes === 0} className={`${activacion ? "aspect-[2/1] w-full rounded-[14px] border-foreground/30 bg-transparent text-foreground/65" : "min-h-36 w-full rounded-xl border-current/25 bg-white/60"} mb-4 flex flex-col items-center justify-center border border-dashed p-6 text-center disabled:cursor-default ${foco}`}>
              <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 h-10 w-10"><path d="M5 10h5l2-4h8l2 4h5v16H5z"/><circle cx="16" cy="18" r="5"/></svg>
              <span className="text-[13px] leading-snug">{activacion ? <>Toca para seleccionar la foto<br />o toma una nueva</> : "Un momento para recordar"}</span>
            </button>
          )}
          {activacion && !listo && <DetalleFotos moderacion={moderacion} />}
          <div aria-live="polite" aria-atomic="true">
            {listo && (
              <div className={`mb-4 rounded-[16px] p-4 text-sm ${activacion ? "bg-rosa/8" : "bg-white/75"}`}>
                <p className={activacion ? "text-[20px] font-extrabold tracking-tight" : "font-semibold"}>{activacion && listo === "aprobada" ? "Tu foto en pantalla" : "¡Recibimos tu foto!"}</p>
                <p className="mt-1 leading-relaxed">{listo === "pendiente" ? "El equipo del evento la revisará antes de mostrarla en la pantalla." : "Tu foto ya está disponible para la pantalla del evento."}</p>
              </div>
            )}
            {restantes === 0 && <p className="mb-4 text-sm leading-relaxed">Ya compartiste {maxFotos === 1 ? "tu foto" : "todas tus fotos"}. ¡Gracias por ser parte de este recuerdo!</p>}
          </div>
          {error && <p role="alert" className="mb-4 text-sm text-rose-700">{error}</p>}
          {restantes !== 0 && (
            <>
              {activacion ? (
                <>
                  <AccionFoto activacion onClick={file ? subir : () => archivoRef.current?.click()} disabled={subiendo} className={foco}>{subiendo ? "Enviando tu foto…" : file ? "Compartir esta foto" : "Seleccionar foto"}</AccionFoto>
                  <div className={`mt-2 gap-2 ${file ? "grid grid-cols-2" : "flex justify-center"}`}>
                    {file && <button type="button" onClick={() => archivoRef.current?.click()} disabled={subiendo} className={secundario}>Cambiar foto</button>}
                    <button type="button" onClick={() => camaraRef.current?.click()} disabled={subiendo} className={file ? secundario : `min-h-11 px-4 text-[13px] font-medium text-rosa disabled:opacity-50 ${foco}`}>Tomar una foto</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => camaraRef.current?.click()} disabled={subiendo} className={secundario}>Tomar foto</button>
                    <button type="button" onClick={() => archivoRef.current?.click()} disabled={subiendo} className={secundario}>Elegir foto</button>
                  </div>
                  {file && <BotonRosa onClick={subir} disabled={subiendo} className={`min-h-11 ${foco}`}>{subiendo ? "Enviando tu foto…" : "Compartir esta foto"}</BotonRosa>}
                </>
              )}
              <p className="mt-3 text-center text-xs leading-relaxed opacity-70">JPG, PNG, WebP o GIF · Máximo 4 MB{!activacion && moderacion && <><br />Las fotos se revisan antes de publicarse.</>}</p>
            </>
          )}
          {activacion && participanteNombre && <p className="mt-3 text-center text-xs leading-relaxed text-foreground/65">Foto de <strong className="font-medium">{participanteNombre}</strong>{restantes !== null && restantes > 0 && <><br />{restantes} {restantes === 1 ? "foto disponible" : "fotos disponibles"}</>}</p>}
          <Link href={`/${slug}`} className={`mt-4 block text-center text-xs underline underline-offset-4 opacity-75 ${foco}`}>{activacion ? "Volver a mi registro" : "Volver al evento"}</Link>
        </>
      )}
    </section>
  );
}
