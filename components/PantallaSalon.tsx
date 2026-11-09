"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { urlArchivo } from "@/lib/urls";
import { etiquetaEvento } from "@/lib/identidad";
import { moduloActivo } from "@/lib/modulos";
import { paletaEvento } from "@/lib/config";
import type { Evento } from "@/lib/db";
import type { DatosPantalla, FotoPantalla, MensajePantalla } from "@/lib/pantalla";
import EnVivo from "./EnVivo";

export type EventoPantalla = Omit<Evento, "id" | "pantalla_token" | "clave">;
export type ModoPantalla = "todo" | "fotos" | "mensajes";

// Ritmo del carrusel. Una foto aguanta más que un mensaje porque la gente la
// mira; una recién subida se queda un buen rato para que su dueño alcance a
// verla desde donde esté bailando. Con varias a la vez, cada escena dura más.
const DURACION = { foto: 9000, mensaje: 8000, destacada: 15000, extraFoto: 2500, extraMensaje: 4000 };
const CADA = 8000; // cada cuánto se pregunta si llegó algo nuevo

type Escena =
  | { tipo: "foto"; clave: string; fotos: FotoPantalla[] }
  | { tipo: "mensaje"; clave: string; mensajes: MensajePantalla[] };

function enGrupos<T>(lista: T[], tamano: number): T[][] {
  const grupos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) grupos.push(lista.slice(i, i + tamano));
  return grupos;
}

// Se alternan fotos y mensajes, de lo más nuevo a lo más viejo: la vuelta
// siempre empieza por lo último que subieron los participantes. Cada escena
// lleva tantas fotos o mensajes como se eligió en el panel (de 1 a 4).
function construirGuion(datos: DatosPantalla, modo: ModoPantalla): Escena[] {
  const fotos = enGrupos(modo === "mensajes" ? [] : datos.fotos, datos.config.fotos);
  const mensajes = enGrupos(modo === "fotos" ? [] : datos.mensajes, datos.config.mensajes);
  const guion: Escena[] = [];
  for (let i = 0; i < Math.max(fotos.length, mensajes.length); i++) {
    if (fotos[i]) guion.push({ tipo: "foto", clave: `f${fotos[i].map((f) => f.id).join("-")}`, fotos: fotos[i] });
    if (mensajes[i]) {
      guion.push({ tipo: "mensaje", clave: `m${mensajes[i].map((m) => m.id).join("-")}`, mensajes: mensajes[i] });
    }
  }
  return guion;
}

// Para no reiniciar el carrusel en cada sondeo: solo interesa si cambió la
// lista (o cuántos van a la vez), no que el servidor haya respondido otro
// objeto igual.
function firma(d: DatosPantalla): string {
  return `${d.fotos.map((f) => f.id).join(",")}|${d.mensajes.map((m) => m.id).join(",")}|${d.config.fotos}${d.config.mensajes}`;
}

function duracionDe(escena: Escena): number {
  return escena.tipo === "foto"
    ? DURACION.foto + (escena.fotos.length - 1) * DURACION.extraFoto
    : DURACION.mensaje + (escena.mensajes.length - 1) * DURACION.extraMensaje;
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
        setDestacada((actual) => actual && nuevos.fotos.some((f) => f.id === actual.id) ? actual : null);
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
  const duracion = destacada ? DURACION.destacada : escena ? duracionDe(escena) : 0;

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

  const activacion = evento.tipo === "activacion";
  const paleta = paletaEvento(evento);
  const estilo = {
    "--p-fondo": oscuro ? (activacion ? "#071a35" : "#14100f") : paleta.fondo,
    "--p-texto": oscuro ? (activacion ? "#f0f8ff" : "#f7efe8") : paleta.texto,
    "--p-tarjeta": oscuro ? "rgba(255,255,255,.07)" : paleta.card,
    "--p-rosa": paleta.rosa,
    "--p-dorado": activacion ? (oscuro ? paleta.dorado : paleta.rosa) : (oscuro ? "#e3d08a" : paleta.dorado),
  } as React.CSSProperties;

  return (
    <div
      onMouseMove={moverMouse}
      style={estilo}
      className={`${activacion ? "pantalla-activacion" : ""} relative h-dvh w-full overflow-hidden bg-[var(--p-fondo)] text-[var(--p-texto)] ${
        controles ? "" : "cursor-none"
      }`}
    >
      {evento.tipo !== "activacion" && <Petalos />}

      {/* Antes de que suba nadie nada, la pantalla entera es la invitación. */}
      {!destacada && !escena ? (
        <>
          {activacion ? <BienvenidaActivacion evento={evento} /> : <Bienvenida evento={evento} modo={modo} />}
          <EnVivo className="absolute right-[3vh] top-[3vh] z-10" />
        </>
      ) : (
        <div className="relative grid h-full grid-cols-[1fr_25vw]">
          <section className="relative overflow-hidden p-[3vh]">
            {destacada ? (
              <EscenaFoto key={`nueva-${destacada.id}`} foto={destacada} nueva />
            ) : escena?.tipo === "foto" ? (
              escena.fotos.length === 1 ? (
                <EscenaFoto key={escena.clave} foto={escena.fotos[0]} />
              ) : (
                <EscenaFotos key={escena.clave} fotos={escena.fotos} />
              )
            ) : escena?.tipo === "mensaje" ? (
              <EscenaMensajes key={escena.clave} mensajes={escena.mensajes} />
            ) : null}
            <EnVivo className="absolute right-[3vh] top-[3vh] z-10" />
          </section>

          <Panel evento={evento} datos={datos} />
        </div>
      )}

      {/* Las fotos siguientes se descargan mientras se miran las actuales. */}
      {siguiente?.tipo === "foto" &&
        siguiente.fotos.map((f) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={f.id}
            src={f.url}
            alt=""
            aria-hidden
            className="pointer-events-none absolute h-px w-px opacity-0"
          />
        ))}

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
  const src = foto.url;
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
        alt="Foto compartida por un participante"
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

// Varias fotos a la vez: cada una entera en su cuadro, sobre su propio fondo
// desenfocado, igual que cuando va sola.
function EscenaFotos({ fotos }: { fotos: FotoPantalla[] }) {
  const columnas = fotos.length === 3 ? "grid-cols-3" : "grid-cols-2";
  const filas = fotos.length === 4 ? "grid-rows-2" : "grid-rows-1";
  return (
    <div className={`pantalla-aparecer grid h-full w-full gap-[2vh] ${columnas} ${filas}`}>
      {fotos.map((foto, i) => (
        <figure
          key={foto.id}
          className="pantalla-subir relative flex min-h-0 items-center justify-center overflow-hidden rounded-[2vh] bg-black/10"
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto.url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-30 blur-2xl saturate-150"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto.url}
            alt="Foto compartida por un participante"
            className="relative max-h-full max-w-full object-contain shadow-xl"
          />
        </figure>
      ))}
    </div>
  );
}

// Los mensajes van siempre en blanco con letra negra, sea cual sea la paleta
// del evento: así se leen igual de lejos con cualquier combinación de colores.
function EscenaMensajes({ mensajes }: { mensajes: MensajePantalla[] }) {
  const n = mensajes.length;
  const columnas = n === 1 ? "grid-cols-1" : n === 3 ? "grid-cols-3" : "grid-cols-2";
  // La letra baja con la cantidad de mensajes y con el largo del más largo.
  const largo = Math.max(...mensajes.map((m) => m.mensaje.length));
  const base = n === 1 ? 6.4 : n === 2 ? 4.2 : n === 3 ? 3.4 : 3.2;
  const tamano = `${(base * (largo > 200 ? 0.62 : largo > 110 ? 0.8 : 1)).toFixed(2)}vh`;
  return (
    <div
      className={`grid h-full w-full content-center gap-[2.5vh] ${columnas} ${n === 4 ? "grid-rows-2" : ""} ${
        n === 1 ? "px-[5vh] py-[8vh]" : "px-[1vh] py-[7vh]"
      }`}
    >
      {mensajes.map((mensaje, i) => (
        <blockquote
          key={mensaje.id}
          className="pantalla-subir flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-[3vh] bg-white px-[4vh] py-[4vh] text-center text-black shadow-2xl"
          style={{ animationDelay: `${i * 0.2}s` }}
        >
          <span aria-hidden className="font-serif leading-none text-black/25" style={{ fontSize: n === 1 ? "12vh" : "8vh", height: n === 1 ? "6vh" : "4vh" }}>
            &ldquo;
          </span>
          <p className="max-w-[46ch] font-serif leading-snug text-balance break-words" style={{ fontSize: tamano }}>
            {mensaje.mensaje}
          </p>
          <footer className="mt-[2.5vh] font-bold text-black/60" style={{ fontSize: n === 1 ? "3.4vh" : "2.4vh" }}>
            {mensaje.nombre}
          </footer>
        </blockquote>
      ))}
    </div>
  );
}

// Al empezar la fiesta, cuando todavía no sube nadie nada: el QR grande al
// centro, para que se lea desde el fondo del salón.
function BienvenidaActivacion({ evento }: { evento: EventoPantalla }) {
  const imagen = urlArchivo(evento.banner || evento.banner_movil);
  const conFotos = moduloActivo(evento, "fotos");
  const conRegistro = moduloActivo(evento, "registro");
  return (
    <div className="activation-screen-welcome pantalla-aparecer">
      <div>
        {imagen && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt={etiquetaEvento(evento)} className="screen-brand" />
        )}
        <h1>{conFotos ? "Comparte tu energía." : etiquetaEvento(evento)}</h1>
        <p className="screen-invitation">{conFotos ? "Tu mejor momento puede aparecer aquí. Súmate a la experiencia." : "Sé parte de la experiencia. Escanea el código y participa."}</p>
      </div>
      <div className="screen-participate">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/eventos/${evento.slug}/qr`} alt="Código QR del evento" className="screen-qr" />
        <p className="text-[4vh] font-bold">Escanea y participa</p>
        <p className="screen-instructions mt-[2vh]">{conRegistro ? "Regístrate desde tu celular." : "Entra desde tu celular."}{conFotos && <><br />Comparte tu foto y aparece en pantalla.</>}</p>
        <p className="mt-[3vh] text-[1.6vh] opacity-75">Una experiencia con <strong>Venito</strong></p>
      </div>
    </div>
  );
}

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
        {evento.tipo === "activacion" ? "EN VIVO" : "MATRIMONIO DE"}
      </p>
      <p className={`${evento.tipo === "activacion" ? "font-sans font-bold" : "font-script"} max-w-[90vw] leading-tight text-[var(--p-dorado)]`} style={{ fontSize: evento.tipo === "activacion" ? "8vh" : "14vh" }}>
        {etiquetaEvento(evento)}
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
        alt="Código QR del evento"
        className="pantalla-respirar my-[4vh] h-[36vh] w-[36vh] rounded-[2vh] bg-white p-[1.5vh] shadow-xl"
      />
      <p className="max-w-[34ch] font-serif text-[3.2vh] leading-snug">
        {moduloActivo(evento, "registro") ? "Escanea el código, regístrate y comparte tu foto." : `Escanea el código con tu celular y ${que}.`}
      </p>
    </div>
  );
}

function Panel({ evento, datos }: { evento: EventoPantalla; datos: DatosPantalla }) {
  // De a tres para que la fila quede siempre completa.
  const miniaturas = datos.fotos.slice(0, datos.fotos.length >= 6 ? 6 : 3);
  return (
    <aside className="pantalla-panel flex h-full flex-col items-center justify-between bg-[var(--p-tarjeta)] px-[2vh] py-[4vh] text-center shadow-[-1vh_0_4vh_rgba(0,0,0,.08)]">
      <header className="w-full">
        {(evento.banner || evento.banner_movil) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlArchivo(evento.banner || evento.banner_movil)} alt={etiquetaEvento(evento)} className="mb-[2vh] max-h-[14vh] w-full object-contain" />
        )}
        <p
          className="font-serif font-bold text-[var(--p-dorado)]"
          style={{ fontSize: "2vh", letterSpacing: ".12em" }}
        >
          {evento.tipo === "activacion" ? "EN VIVO" : "MATRIMONIO DE"}
        </p>
        <p className={`${evento.tipo === "activacion" ? "font-sans font-bold" : "font-script"} break-words leading-tight text-[var(--p-dorado)]`} style={{ fontSize: evento.tipo === "activacion" ? "4vh" : "8vh" }}>
          {etiquetaEvento(evento)}
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
          alt="Código QR del evento"
          className="mx-auto w-[16vw] max-w-[26vh] rounded-[2vh] bg-white p-[1.4vh] shadow-xl"
        />
        <p className="mt-[2vh] font-serif font-bold leading-snug" style={{ fontSize: "2.4vh" }}>
          Escanea y súmate
        </p>
        <p className="mt-[.6vh] leading-snug opacity-70" style={{ fontSize: "1.8vh" }}>
          {moduloActivo(evento, "fotos") && moduloActivo(evento, "mensajes")
            ? "Comparte tu foto o mensaje del evento"
            : evento.tipo === "activacion"
            ? moduloActivo(evento, "registro")
              ? moduloActivo(evento, "fotos") ? "Regístrate y comparte tu foto" : "Regístrate y participa"
              : moduloActivo(evento, "fotos") ? "Comparte tu foto del evento" : "Participa desde tu celular"
            : "Sube tus fotos y deja un mensaje a los novios"}
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
                  src={f.url}
                  alt=""
                  className="pantalla-miniatura aspect-square w-full rounded-[1vh] object-cover shadow"
                />
              ))}
            </div>
          </>
        )}
        <p className="mt-[2vh] opacity-60" style={{ fontSize: "1.7vh" }}>
          {cuenta(datos.totales.fotos, "foto")}{moduloActivo(evento, "mensajes") && ` · ${cuenta(datos.totales.mensajes, "mensaje")}`}
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
