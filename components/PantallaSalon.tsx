"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { urlArchivo } from "@/lib/urls";
import { COLORES } from "@/lib/config";
import type { Evento } from "@/lib/db";
import type { DatosPantalla, FotoPantalla, MensajePantalla } from "@/lib/pantalla";

export type EventoPantalla = Omit<Evento, "id" | "pantalla_token" | "clave">;
export type ModoPantalla = "todo" | "fotos" | "mensajes";

// Ritmo del carrusel. Una foto aguanta más que un mensaje porque la gente la
// mira; una recién subida se queda un buen rato para que su dueño alcance a
// verla desde donde esté bailando.
const DURACION = { foto: 9000, mensaje: 8000, destacada: 15000 };
const CADA = 8000; // cada cuánto se pregunta si llegó algo nuevo

const HEX = /^#[0-9a-fA-F]{6}$/;
const color = (v: string, porDefecto: string) => (HEX.test(v) ? v : porDefecto);

type Escena =
  | { tipo: "foto"; clave: string; foto: FotoPantalla }
  | { tipo: "mensaje"; clave: string; mensaje: MensajePantalla };

// Se alterna foto y mensaje, ambos de lo más nuevo a lo más viejo: la vuelta
// siempre empieza por lo último que subieron los invitados.
function construirGuion(datos: DatosPantalla, modo: ModoPantalla): Escena[] {
  const fotos = modo === "mensajes" ? [] : datos.fotos;
  const mensajes = modo === "fotos" ? [] : datos.mensajes;
  const guion: Escena[] = [];
  for (let i = 0; i < Math.max(fotos.length, mensajes.length); i++) {
    if (fotos[i]) guion.push({ tipo: "foto", clave: `f${fotos[i].id}`, foto: fotos[i] });
    if (mensajes[i]) {
      guion.push({ tipo: "mensaje", clave: `m${mensajes[i].id}`, mensaje: mensajes[i] });
    }
  }
  return guion;
}

// Para no reiniciar el carrusel en cada sondeo: solo interesa si cambió la
// lista, no que el servidor haya respondido otro objeto igual.
function firma(d: DatosPantalla): string {
  return `${d.fotos.map((f) => f.id).join(",")}|${d.mensajes.map((m) => m.id).join(",")}`;
}

const cuenta = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? "" : "s"}`;

// created_at viene de SQLite en UTC y sin zona horaria.
function haceCuanto(created_at: string): string {
  const t = Date.parse(`${created_at.replace(" ", "T")}Z`);
  if (Number.isNaN(t)) return "";
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  return horas < 24 ? `hace ${horas} h` : "";
}

// Pétalos de fondo: posiciones fijas para que servidor y navegador dibujen lo
// mismo (nada de valores al azar en el render).
const PETALOS = [
  [4, 0, 23], [13, 7, 30], [22, 14, 26], [31, 3, 34], [40, 18, 28], [49, 9, 24],
  [58, 21, 32], [67, 5, 27], [76, 16, 30], [85, 11, 25], [93, 2, 33], [97, 19, 29],
];

export default function PantallaSalon({
  evento,
  inicial,
  clave,
  modo,
  fondoOscuro,
}: {
  evento: EventoPantalla;
  inicial: DatosPantalla;
  clave: string;
  modo: ModoPantalla;
  fondoOscuro: boolean;
}) {
  const [datos, setDatos] = useState(inicial);
  const [paso, setPaso] = useState(0);
  const [destacada, setDestacada] = useState<FotoPantalla | null>(null);
  const [oscuro, setOscuro] = useState(fondoOscuro);
  const [controles, setControles] = useState(false);
  const firmaActual = useRef(firma(inicial));
  const ultimaVista = useRef(inicial.fotos[0]?.id ?? 0);
  const ocultar = useRef<number | null>(null);

  // Preguntar por material nuevo. Si aparece una foto que no habíamos visto se
  // interrumpe el carrusel para mostrarla al instante.
  useEffect(() => {
    const url = `/api/eventos/${evento.slug}/pantalla${
      clave ? `?k=${encodeURIComponent(clave)}` : ""
    }`;
    let vivo = true;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || !vivo) return;
        const nuevos: DatosPantalla = await res.json();
        if (firma(nuevos) === firmaActual.current) return;
        firmaActual.current = firma(nuevos);
        setDatos(nuevos);
        const ultima = nuevos.fotos[0];
        if (ultima && ultima.id > ultimaVista.current) {
          ultimaVista.current = ultima.id;
          setDestacada(ultima);
          setPaso(0);
        }
      } catch {
        // Si el wifi del salón falla, la pantalla sigue con lo que ya tiene.
      }
    }, CADA);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [evento.slug, clave]);

  const guion = useMemo(() => construirGuion(datos, modo), [datos, modo]);
  const escena = destacada || guion.length === 0 ? null : guion[paso % guion.length];
  const siguiente = guion.length ? guion[(paso + 1) % guion.length] : null;
  const claveEscena = destacada ? `nueva-${destacada.id}` : (escena?.clave ?? "");
  const duracion = destacada ? DURACION.destacada : escena ? DURACION[escena.tipo] : 0;

  useEffect(() => {
    if (!claveEscena || !duracion) return;
    const t = window.setTimeout(() => {
      setDestacada(null);
      setPaso((p) => p + 1);
    }, duracion);
    return () => window.clearTimeout(t);
  }, [claveEscena, duracion]);

  useEffect(() => () => window.clearTimeout(ocultar.current ?? undefined), []);

  function moverMouse() {
    setControles(true);
    window.clearTimeout(ocultar.current ?? undefined);
    ocultar.current = window.setTimeout(() => setControles(false), 3000);
  }

  function pantallaCompleta() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  const dorado = color(evento.color_dorado, COLORES.dorado);
  const rosa = color(evento.color_rosa, COLORES.rosa);
  const estilo = {
    "--p-fondo": oscuro ? "#14100f" : color(evento.color_fondo, COLORES.fondo),
    "--p-texto": oscuro ? "#f7efe8" : color(evento.color_texto, COLORES.texto),
    "--p-tarjeta": oscuro ? "rgba(255,255,255,.07)" : color(evento.color_card, COLORES.card),
    "--p-rosa": rosa,
    "--p-dorado": oscuro ? "#e3d08a" : dorado,
  } as React.CSSProperties;

  return (
    <div
      onMouseMove={moverMouse}
      style={estilo}
      className={`relative h-dvh w-full overflow-hidden bg-[var(--p-fondo)] text-[var(--p-texto)] ${
        controles ? "" : "cursor-none"
      }`}
    >
      <Petalos />

      {/* Antes de que suba nadie nada, la pantalla entera es la invitación. */}
      {!destacada && !escena ? (
        <Bienvenida evento={evento} modo={modo} />
      ) : (
        <div className="relative grid h-full grid-cols-[1fr_25vw]">
          <section className="relative overflow-hidden p-[3vh]">
            {destacada ? (
              <EscenaFoto key={`nueva-${destacada.id}`} foto={destacada} nueva />
            ) : escena?.tipo === "foto" ? (
              <EscenaFoto key={escena.clave} foto={escena.foto} />
            ) : escena?.tipo === "mensaje" ? (
              <EscenaMensaje key={escena.clave} mensaje={escena.mensaje} />
            ) : null}
          </section>

          <Panel evento={evento} datos={datos} />
        </div>
      )}

      {/* La siguiente foto se descarga mientras se mira la actual. */}
      {siguiente?.tipo === "foto" && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={urlArchivo(siguiente.foto.archivo)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      )}

      <div
        className={`absolute bottom-[2vh] left-[2vh] flex gap-2 text-[1.5vh] transition-opacity ${
          controles ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          onClick={pantallaCompleta}
          className="rounded-full bg-black/50 px-4 py-2 text-white backdrop-blur hover:bg-black/70"
        >
          Pantalla completa
        </button>
        <button
          onClick={() => setOscuro((v) => !v)}
          className="rounded-full bg-black/50 px-4 py-2 text-white backdrop-blur hover:bg-black/70"
        >
          {oscuro ? "Fondo claro" : "Fondo oscuro"}
        </button>
      </div>
    </div>
  );
}

function EscenaFoto({ foto, nueva }: { foto: FotoPantalla; nueva?: boolean }) {
  const src = urlArchivo(foto.archivo);
  // La foto se muestra entera: nadie queda fuera de cuadro por un recorte. El
  // movimiento lento va en el fondo desenfocado, que además tapa las franjas
  // vacías de las fotos verticales.
  return (
    <figure className="pantalla-aparecer relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="pantalla-fondo absolute inset-0 h-full w-full object-cover opacity-30 blur-3xl saturate-150"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Foto compartida por un invitado"
        className="relative max-h-full max-w-full rounded-[2vh] object-contain shadow-2xl"
      />

      {nueva ? (
        <p className="pantalla-latir absolute bottom-[2vh] rounded-full bg-[var(--p-rosa)] px-[3vh] py-[1.2vh] text-[2.2vh] font-bold text-white shadow-xl">
          ¡Acaba de llegar una foto nueva!
        </p>
      ) : (
        <figcaption
          suppressHydrationWarning
          className="absolute bottom-0 right-0 rounded-full bg-black/45 px-[1.8vh] py-[.7vh] text-[1.6vh] text-white backdrop-blur"
        >
          {haceCuanto(foto.created_at)}
        </figcaption>
      )}
    </figure>
  );
}

function EscenaMensaje({ mensaje }: { mensaje: MensajePantalla }) {
  const largo = mensaje.mensaje.length;
  const tamano = largo > 200 ? "4vh" : largo > 110 ? "5.2vh" : "6.4vh";
  return (
    <blockquote className="pantalla-aparecer flex h-full flex-col items-center justify-center px-[6vh] text-center">
      <span
        aria-hidden
        className="font-serif leading-none text-[var(--p-dorado)] opacity-60"
        style={{ fontSize: "14vh" }}
      >
        &ldquo;
      </span>
      <p
        className="pantalla-subir -mt-[4vh] max-w-[46ch] font-serif leading-snug text-balance"
        style={{ fontSize: tamano }}
      >
        {mensaje.mensaje}
      </p>
      <footer
        className="pantalla-subir mt-[4vh] font-script text-[var(--p-dorado)]"
        style={{ fontSize: "7vh", animationDelay: ".25s" }}
      >
        {mensaje.nombre}
      </footer>
    </blockquote>
  );
}

// Al empezar la fiesta, cuando todavía no sube nadie nada: el QR grande al
// centro, para que se lea desde el fondo del salón.
function Bienvenida({ evento, modo }: { evento: EventoPantalla; modo: ModoPantalla }) {
  const que =
    modo === "fotos"
      ? "sube la primera foto"
      : modo === "mensajes"
        ? "deja el primer mensaje"
        : "comparte la primera foto o el primer mensaje";
  return (
    <div className="pantalla-aparecer relative flex h-full flex-col items-center justify-center px-[6vh] text-center">
      <p
        className="font-serif font-bold text-[var(--p-dorado)]"
        style={{ fontSize: "2.6vh", letterSpacing: ".12em" }}
      >
        MATRIMONIO DE
      </p>
      <p className="font-script leading-none text-[var(--p-dorado)]" style={{ fontSize: "14vh" }}>
        {evento.nombre1}
        <span style={{ fontSize: "0.55em" }}> y </span>
        {evento.nombre2}
      </p>
      {evento.fecha && (
        <p
          className="mt-[1vh] font-serif font-bold text-[var(--p-dorado)]"
          style={{ fontSize: "3vh", letterSpacing: ".18em" }}
        >
          {evento.fecha}
        </p>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/eventos/${evento.slug}/qr`}
        alt="Código QR del matrimonio"
        className="pantalla-respirar my-[4vh] h-[36vh] w-[36vh] rounded-[2vh] bg-white p-[1.5vh] shadow-xl"
      />
      <p className="max-w-[34ch] font-serif text-[3.2vh] leading-snug">
        Escanea el código con tu celular y {que}.
      </p>
    </div>
  );
}

function Panel({ evento, datos }: { evento: EventoPantalla; datos: DatosPantalla }) {
  // De a tres para que la fila quede siempre completa.
  const miniaturas = datos.fotos.slice(0, datos.fotos.length >= 6 ? 6 : 3);
  return (
    <aside className="flex h-full flex-col items-center justify-between bg-[var(--p-tarjeta)] px-[2vh] py-[4vh] text-center shadow-[-1vh_0_4vh_rgba(0,0,0,.08)]">
      <header>
        <p
          className="font-serif font-bold text-[var(--p-dorado)]"
          style={{ fontSize: "2vh", letterSpacing: ".12em" }}
        >
          MATRIMONIO DE
        </p>
        <p className="font-script leading-none text-[var(--p-dorado)]" style={{ fontSize: "8vh" }}>
          {evento.nombre1}
          <span style={{ fontSize: "0.55em" }}> y </span>
          {evento.nombre2}
        </p>
        {evento.fecha && (
          <p
            className="mt-[1vh] font-serif font-bold text-[var(--p-dorado)]"
            style={{ fontSize: "2.2vh", letterSpacing: ".18em" }}
          >
            {evento.fecha}
          </p>
        )}
      </header>

      <div className="pantalla-respirar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/eventos/${evento.slug}/qr`}
          alt="Código QR del matrimonio"
          className="mx-auto w-[16vw] max-w-[26vh] rounded-[2vh] bg-white p-[1.4vh] shadow-xl"
        />
        <p className="mt-[2vh] font-serif font-bold leading-snug" style={{ fontSize: "2.4vh" }}>
          Escanea y súmate
        </p>
        <p className="mt-[.6vh] leading-snug opacity-70" style={{ fontSize: "1.8vh" }}>
          Sube tus fotos y déjales
          <br />
          un mensaje a los novios
        </p>
      </div>

      <div className="w-full">
        {miniaturas.length > 0 && (
          <>
            <p
              className="mb-[1.2vh] font-serif font-bold opacity-60"
              style={{ fontSize: "1.6vh", letterSpacing: ".1em" }}
            >
              ÚLTIMAS FOTOS
            </p>
            <div className="grid grid-cols-3 gap-[.8vh]">
              {miniaturas.map((f) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={f.id}
                  src={urlArchivo(f.archivo)}
                  alt=""
                  className="pantalla-miniatura aspect-square w-full rounded-[1vh] object-cover shadow"
                />
              ))}
            </div>
          </>
        )}
        <p className="mt-[2vh] opacity-60" style={{ fontSize: "1.7vh" }}>
          {cuenta(datos.totales.fotos, "foto")} · {cuenta(datos.totales.mensajes, "mensaje")}
        </p>
      </div>
    </aside>
  );
}

function Petalos() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PETALOS.map(([izq, retraso, duracion]) => (
        <span
          key={izq}
          className="pantalla-flotar absolute bottom-[-8vh] block h-[1.6vh] w-[1.6vh] rounded-[100%_0_100%_0] bg-[var(--p-rosa)]"
          style={{
            left: `${izq}%`,
            animationDelay: `-${retraso}s`,
            animationDuration: `${duracion}s`,
          }}
        />
      ))}
    </div>
  );
}
