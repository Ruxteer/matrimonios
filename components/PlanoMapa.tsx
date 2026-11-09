"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

  // Con mouse el plano se arrastra (deslizar de lado con la rueda es
  // incómodo). Un arrastre no debe abrir la zona sobre la que se soltó.
  const arrastre = useRef<{ x: number; desde: number; movido: boolean } | null>(null);
  function alApretar(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0 || !marco.current) return;
    arrastre.current = { x: e.clientX, desde: marco.current.scrollLeft, movido: false };
  }
  function alMover(e: React.PointerEvent) {
    const a = arrastre.current;
    if (!a || !marco.current) return;
    if (!(e.buttons & 1)) {
      arrastre.current = null;
      return;
    }
    const dx = e.clientX - a.x;
    if (Math.abs(dx) > 4) a.movido = true;
    if (a.movido) marco.current.scrollLeft = a.desde - dx;
  }
  function alSoltar() {
    if (arrastre.current && !arrastre.current.movido) arrastre.current = null;
  }
  function alHacerClic(e: React.MouseEvent) {
    if (arrastre.current?.movido) {
      e.preventDefault();
      e.stopPropagation();
    }
    arrastre.current = null;
  }

  // Las flechas del aviso mueven el plano más de la mitad de lo que se ve.
  function desplazar(sentido: 1 | -1) {
    const m = marco.current;
    if (!m) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    m.scrollBy({ left: sentido * m.clientWidth * 0.6, behavior: quieto ? "auto" : "smooth" });
  }

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
      {/* Sin desvanecidos en los bordes: tapaban los nombres que quedan en la
          orilla del plano. El corte del plano y las flechas de abajo bastan
          para mostrar que sigue hacia el lado. */}
      <div
        ref={marco}
        onScroll={alDesplazar}
        onPointerDown={alApretar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onClickCapture={alHacerClic}
        // Los puntos son links y el navegador los arrastraría como tales,
        // cortando el arrastre del plano.
        onDragStart={(e) => e.preventDefault()}
        className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          desplazable ? "plano-arrastrable select-none" : ""
        }`}
      >
        {/* Los puntos miden en proporción a este ancho (@container): tapan lo
            mismo del plano en el teléfono, en el computador y en el panel. */}
        <div className="@container relative" style={{ width: ancho }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imagen} src={src} alt="Plano del lugar" draggable={false} className="block w-full" />
          {children}
        </div>
      </div>
      {desplazable && (
        <div className="pista-mapa mt-2.5 flex items-center justify-center gap-3 text-[12px]">
          <button
            type="button"
            onClick={() => desplazar(-1)}
            disabled={!bordes.izquierda}
            aria-label="Ver la parte izquierda del plano"
            className="grid size-8 place-items-center rounded-full border border-current/15 bg-gris-card transition duration-300 hover:border-current/30 disabled:opacity-30"
          >
            <ChevronLeft className="pista-flecha pista-flecha-izquierda size-4" strokeWidth={2.25} aria-hidden="true" />
          </button>
          <span className="opacity-70">
            <span className="pista-tactil">Desliza para recorrer el plano</span>
            <span className="pista-mouse">Arrastra el plano para recorrerlo</span>
          </span>
          <button
            type="button"
            onClick={() => desplazar(1)}
            disabled={!bordes.derecha}
            aria-label="Ver la parte derecha del plano"
            className="grid size-8 place-items-center rounded-full border border-current/15 bg-gris-card transition duration-300 hover:border-current/30 disabled:opacity-30"
          >
            <ChevronRight className="pista-flecha size-4" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
