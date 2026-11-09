"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Alto con que se muestra un plano apaisado: en un teléfono un plano ancho
// queda de unos 200 px de alto, sus nombres no se leen y cualquier punto tapa
// lo que marca. Así se ve más grande y se recorre deslizando hacia el lado.
const ALTO = 320;
// Desde qué proporción un plano se considera apaisado.
const APAISADO = 1.25;

// Lo que se recuerda de cada plano mientras la persona navega por el sitio:
// su forma y hasta dónde lo deslizó. Al volver de la ficha de una zona el
// plano aparece igual que como lo dejó, sin medirse de nuevo ni saltar, y el
// punto de la zona puede volver a su lugar con la transición.
const memoria = new Map<string, { aspecto: number; desplazamiento: number | null }>();

export default function PlanoMapa({
  src,
  children,
}: {
  src: string;
  /** Los puntos de las zonas, en porcentaje del plano. */
  children: React.ReactNode;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLImageElement>(null);
  const [aspecto, setAspecto] = useState<number | null>(() => memoria.get(src)?.aspecto ?? null);
  // La primera vez el plano aparece y sus puntos entran uno tras otro; al
  // volver ya están en su lugar.
  const [primeraVez] = useState(() => !memoria.has(src));
  const [bordes, setBordes] = useState({ izquierda: false, derecha: false });

  // La forma del plano se conoce al cargarlo (puede llegar ya cargado del caché).
  useEffect(() => {
    const img = imagen.current;
    if (!img || aspecto !== null) return;
    const medir = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const forma = img.naturalWidth / img.naturalHeight;
      memoria.set(src, { aspecto: forma, desplazamiento: null });
      setAspecto(forma);
    };
    if (img.complete) {
      const cuadro = requestAnimationFrame(medir);
      return () => cancelAnimationFrame(cuadro);
    }
    img.addEventListener("load", medir);
    return () => img.removeEventListener("load", medir);
  }, [src, aspecto]);

  // Antes de pintarse: la primera vez parte mostrando el centro; al volver,
  // donde quedó. Va en un efecto de layout para que la transición de vuelta
  // encuentre el punto ya en su sitio.
  useLayoutEffect(() => {
    const m = marco.current;
    if (!m || aspecto === null) return;
    const guardado = memoria.get(src)?.desplazamiento;
    m.scrollLeft = guardado ?? (m.scrollWidth - m.clientWidth) / 2;
    const cuadro = requestAnimationFrame(() => alDesplazar());
    return () => cancelAnimationFrame(cuadro);
    // alDesplazar solo lee el marco: no hace falta como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspecto, src]);

  function alDesplazar() {
    const m = marco.current;
    if (!m) return;
    const recuerdo = memoria.get(src);
    if (recuerdo) recuerdo.desplazamiento = m.scrollLeft;
    setBordes({
      izquierda: m.scrollLeft > 4,
      derecha: m.scrollLeft + m.clientWidth < m.scrollWidth - 4,
    });
  }

  const desplazable = aspecto !== null && aspecto > APAISADO;
  const ancho = desplazable ? `max(100%, ${Math.round(ALTO * aspecto)}px)` : "100%";

  return (
    <div
      className="plano-mapa"
      data-listo={aspecto !== null ? "" : undefined}
      data-entrada={primeraVez ? "" : undefined}
    >
      <div className="relative">
        <div
          ref={marco}
          onScroll={alDesplazar}
          className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
        >
          {/* Los puntos miden en proporción a este ancho (@container): tapan lo
              mismo del plano en el teléfono, en el computador y en el panel. */}
          <div className="@container relative" style={{ width: ancho }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imagen} src={src} alt="Plano del lugar" draggable={false} className="block w-full" />
            {children}
          </div>
        </div>
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-background to-transparent transition-opacity duration-500 ${
            bordes.izquierda ? "opacity-100" : "opacity-0"
          }`}
        />
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background to-transparent transition-opacity duration-500 ${
            bordes.derecha ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
      {desplazable && (
        <p className="pista-mapa mt-2.5 flex items-center justify-center gap-2 text-[12px] opacity-70">
          <span aria-hidden className="pista-flecha pista-flecha-izquierda">←</span>
          Desliza para recorrer el plano
          <span aria-hidden className="pista-flecha">→</span>
        </p>
      )}
    </div>
  );
}
