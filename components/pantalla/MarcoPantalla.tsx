"use client";

import { useEffect, useRef, useState } from "react";
import EnVivo from "@/components/EnVivo";
import { paletaEvento } from "@/lib/config";
import { luminancia, mezclar, textoSobre } from "@/lib/colores";
import { etiquetaEvento } from "@/lib/identidad";
import { urlArchivo } from "@/lib/urls";
import type { EventoPantalla } from "@/components/PantallaSalon";

// El marco de las pantallas que se proyectan durante el evento (votación y
// sorteo): a la izquierda lo que pasa, con el indicador EN VIVO; a la derecha
// el evento y el QR para sumarse. Los colores salen de la paleta del evento.
export default function MarcoPantalla({
  evento,
  lateral,
  controles,
  fondo: fondoPropio,
  children,
}: {
  evento: EventoPantalla;
  lateral: React.ReactNode;
  /** Imagen de fondo propia (la foto del premio); si no, la del evento. */
  fondo?: string;
  /** Botones extra de la barra que aparece al mover el mouse. */
  controles?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [visibles, setVisibles] = useState(false);
  const ocultar = useRef<number | null>(null);
  useEffect(() => () => window.clearTimeout(ocultar.current ?? undefined), []);

  function moverMouse() {
    setVisibles(true);
    window.clearTimeout(ocultar.current ?? undefined);
    ocultar.current = window.setTimeout(() => setVisibles(false), 3000);
  }

  function pantallaCompleta() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  const paleta = paletaEvento(evento);
  const activacion = evento.tipo === "activacion";
  // En una activación el banner propio hace de fondo; en un matrimonio, el
  // color del evento llevado a un tono profundo para que el blanco se lea.
  const fondo = fondoPropio || (activacion && evento.banner ? urlArchivo(evento.banner) : "");
  const estilo = {
    "--p-fondo": paleta.fondo,
    "--p-texto": paleta.texto,
    "--p-tarjeta": paleta.card,
    "--p-rosa": paleta.rosa,
    "--p-rosa-texto": textoSobre(paleta.rosa),
    "--p-profundo": mezclar(paleta.rosa, "#000000", 0.45),
    "--p-noche": mezclar(paleta.rosa, "#000000", 0.72),
    "--p-dorado": paleta.dorado,
    // El color del evento con contraste suficiente sobre blanco (para nombres
    // y cifras dentro de las tarjetas blancas): una paleta clara se oscurece.
    "--p-acento": luminancia(paleta.rosa) > 0.3 ? mezclar(paleta.rosa, "#000000", 0.5) : paleta.rosa,
  } as React.CSSProperties;

  return (
    <div
      onMouseMove={moverMouse}
      style={estilo}
      className={`relative grid h-dvh w-full grid-cols-[1fr_25vw] overflow-hidden bg-[var(--p-fondo)] font-sans text-[var(--p-texto)] ${
        visibles ? "" : "cursor-none"
      }`}
    >
      <section className="relative isolate overflow-hidden bg-[linear-gradient(160deg,var(--p-profundo),var(--p-noche))] text-white">
        {fondo && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={fondo} src={fondo} alt="" aria-hidden className="pantalla-fondo absolute inset-0 -z-10 h-full w-full object-cover" />
            <div
              aria-hidden
              className={`absolute inset-0 -z-10 ${
                fondoPropio
                  ? "bg-[linear-gradient(100deg,rgba(0,0,0,.62)_0%,rgba(0,0,0,.38)_55%,rgba(0,0,0,.12)_100%)]"
                  : "bg-[linear-gradient(180deg,rgba(0,0,0,.25)_0%,rgba(0,0,0,.35)_45%,rgba(0,0,0,.82)_100%)]"
              }`}
            />
          </>
        )}
        {children}
        <EnVivo className="absolute right-[3vh] top-[3vh] z-20" />
      </section>

      <aside className="flex h-full flex-col items-center gap-[3vh] overflow-hidden bg-[var(--p-tarjeta)] px-[2.5vh] py-[4vh] text-center shadow-[-1vh_0_4vh_rgba(0,0,0,.12)]">
        <header className="w-full">
          {(evento.banner || evento.banner_movil) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlArchivo(evento.banner || evento.banner_movil)}
              alt={etiquetaEvento(evento)}
              className="mb-[2vh] max-h-[13vh] w-full rounded-[1.5vh] object-cover"
            />
          )}
          <p className="text-[3.4vh] font-extrabold leading-tight">{etiquetaEvento(evento)}</p>
          {evento.fecha && <p className="mt-[.5vh] text-[1.9vh] font-bold opacity-70">{evento.fecha}</p>}
        </header>
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-[2vh]">{lateral}</div>
        <p className="text-[1.5vh] opacity-60">
          Una experiencia con <strong>Venito</strong>
        </p>
      </aside>

      <div
        className={`absolute bottom-[2vh] left-[2vh] z-30 flex gap-2 text-[1.5vh] transition-opacity ${
          visibles ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          onClick={pantallaCompleta}
          className="rounded-full bg-black/50 px-4 py-2 text-white backdrop-blur hover:bg-black/70"
        >
          Pantalla completa
        </button>
        {controles}
      </div>
    </div>
  );
}

/** El QR de la pantalla, a la sección donde se participa. */
export function QrPantalla({
  slug,
  ruta,
  titulo,
  texto,
}: {
  slug: string;
  ruta: string;
  titulo: string;
  texto?: string;
}) {
  return (
    <div className="pantalla-respirar w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/eventos/${slug}/qr?ruta=${encodeURIComponent(ruta)}`}
        alt="Código QR para participar"
        className="mx-auto aspect-square w-[15vw] max-w-[28vh] rounded-[2vh] bg-white p-[1.3vh] shadow-xl"
      />
      <p className="mx-auto mt-[2vh] w-fit rounded-full bg-[var(--p-rosa)] px-[2.4vh] py-[1vh] text-[2.2vh] font-extrabold text-[var(--p-rosa-texto)] shadow">
        {titulo}
      </p>
      {texto && <p className="mx-auto mt-[1.4vh] max-w-[28ch] text-[1.8vh] leading-snug opacity-75">{texto}</p>}
    </div>
  );
}
