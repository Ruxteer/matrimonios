"use client";

import { useEffect, useRef, useState } from "react";
import MarcoPantalla, { QrPantalla } from "./MarcoPantalla";
import type { EventoPantalla } from "@/components/PantallaSalon";
import type { SorteoPantalla } from "@/lib/sorteos";

const CADA = 3000; // cada cuánto se pregunta por el estado (una fila)
const CONTEO_CADA = 5; // y cada cuántas vueltas se cuenta a los participantes
const TOMBOLA = 6500; // lo que dura la tómbola antes de mostrar al ganador
const PAUSA_FINAL = 1400; // el nombre ganador quieto un momento antes de celebrar

type Fase = "espera" | "listo" | "sorteando" | "ganador" | "fin";
type Tombola = { pool: string[]; ganador: string; nombre: string; paso: number };

const miles = (n: number) => n.toLocaleString("es-CL");

// El sorteo proyectado en el salón. Pasa por cuatro momentos:
//  1. espera: la foto del premio, cuánta gente participa y la cuenta regresiva,
//     con el QR para inscribirse al lado;
//  2. listo: llegó la hora, se ve la lista de participantes y el botón para sortear;
//  3. la tómbola: los nombres pasan cada vez más lento hasta el ganador;
//  4. el ganador en grande, con papel picado, hasta que el organizador lo cierre.
// Si el sorteo se hace desde el panel, la pantalla lo detecta y corre la tómbola igual.
export default function PantallaSorteo({
  evento,
  inicial,
  clave,
}: {
  evento: EventoPantalla;
  inicial: SorteoPantalla;
  clave: string;
}) {
  const [sorteo, setSorteo] = useState(inicial);
  const [nombres, setNombres] = useState(inicial.nombres ?? []);
  const [ahora, setAhora] = useState<number | null>(null);
  const [tombola, setTombola] = useState<Tombola | null>(null);
  const [cerrado, setCerrado] = useState(""); // ejecutado_at del resultado que se cerró
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const desfase = useRef(0); // reloj del servidor menos el del notebook
  const visto = useRef(inicial.ejecutado_at); // el resultado que ya se mostró
  const nombresRef = useRef(nombres);
  useEffect(() => {
    nombresRef.current = nombres;
  }, [nombres]);

  const url = `/api/eventos/${evento.slug}/sorteos/${inicial.id}/pantalla?k=${encodeURIComponent(clave)}`;

  // Todo lo que llega del servidor pasa por aquí: si trae un resultado nuevo
  // (de este botón o del panel), arranca la tómbola.
  function recibir(datos: SorteoPantalla) {
    desfase.current = Date.parse(datos.ahora) - Date.now();
    if (datos.nombres) setNombres(datos.nombres);
    setSorteo((antes) => ({ ...datos, participantes: datos.participantes ?? antes.participantes }));
    if (datos.ejecutado_at && datos.ejecutado_at !== visto.current && datos.ganadores.length) {
      visto.current = datos.ejecutado_at;
      const pool = nombresRef.current.length ? nombresRef.current : datos.ganadores;
      setTombola({ pool, ganador: datos.ganadores[0], nombre: pool[0], paso: 0 });
    }
  }
  const recibirRef = useRef(recibir);
  useEffect(() => {
    recibirRef.current = recibir;
  });

  // Reloj de la cuenta regresiva, con la hora del servidor.
  useEffect(() => {
    desfase.current = Date.parse(inicial.ahora) - Date.now();
    const tic = () => setAhora(Date.now() + desfase.current);
    const primero = window.setTimeout(tic, 0);
    const tarea = window.setInterval(tic, 500);
    return () => {
      window.clearTimeout(primero);
      window.clearInterval(tarea);
    };
  }, [inicial.ahora]);

  // Consulta el estado; cada tantas vueltas (o siempre, si la gente se está
  // inscribiendo) cuenta a los participantes y trae nombres para la lista.
  useEffect(() => {
    let vivo = true;
    let vuelta = 0;
    const tarea = window.setInterval(async () => {
      vuelta++;
      const completa = vuelta % CONTEO_CADA === 0;
      const contar = completa || inicial.fuente === "inscritos";
      try {
        const res = await fetch(`${url}${completa ? "&nombres=1" : ""}${contar ? "" : "&conteo=0"}`, {
          cache: "no-store",
        });
        if (res.ok && vivo) recibirRef.current(await res.json());
      } catch {
        // Sin conexión un momento: se queda con lo último y vuelve a intentar.
      }
    }, CADA);
    return () => {
      vivo = false;
      window.clearInterval(tarea);
    };
  }, [url, inicial.fuente]);

  // La tómbola: un nombre al azar tras otro, cada vez más lento, hasta el ganador.
  const enMarcha = tombola !== null;
  useEffect(() => {
    if (!enMarcha) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reducido ? 1500 : TOMBOLA;
    let transcurrido = 0;
    let temporizador = 0;
    function siguiente() {
      const avance = Math.min(1, transcurrido / total);
      const espera = 55 + 420 * avance * avance;
      transcurrido += espera;
      if (transcurrido >= total) {
        setTombola((t) => t && { ...t, nombre: t.ganador, paso: t.paso + 1 });
        temporizador = window.setTimeout(() => setTombola(null), PAUSA_FINAL);
        return;
      }
      setTombola((t) => {
        if (!t) return t;
        let nombre = t.pool[Math.floor(Math.random() * t.pool.length)];
        if (nombre === t.nombre && t.pool.length > 1) nombre = t.pool[(t.pool.indexOf(nombre) + 1) % t.pool.length];
        return { ...t, nombre, paso: t.paso + 1 };
      });
      temporizador = window.setTimeout(siguiente, espera);
    }
    temporizador = window.setTimeout(siguiente, 0);
    return () => window.clearTimeout(temporizador);
  }, [enMarcha]);

  async function realizar() {
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(url, { method: "POST" });
      const datos = await res.json().catch(() => null);
      if (!res.ok) {
        setError(datos?.error ?? "No pudimos realizar el sorteo. Intenta otra vez.");
        return;
      }
      recibir(datos);
    } catch {
      setError("Sin conexión. Revisa el internet del notebook e intenta otra vez.");
    } finally {
      setEnviando(false);
    }
  }

  const reloj = ahora ?? Date.parse(sorteo.ahora);
  const cuando = sorteo.fecha_sorteo ? Date.parse(sorteo.fecha_sorteo) : NaN;
  const restante = Number.isNaN(cuando) ? 0 : Math.max(0, cuando - reloj);
  const fase: Fase = tombola
    ? "sorteando"
    : sorteo.ejecutado_at
      ? cerrado === sorteo.ejecutado_at
        ? "fin"
        : "ganador"
      : restante > 0
        ? "espera"
        : "listo";

  const participantes = sorteo.participantes ?? 0;
  // Mientras se pueda entrar, el QR manda; después, el premio.
  const inscripcion = sorteo.fuente === "inscritos" && !sorteo.ejecutado_at && (restante > 0 || !sorteo.fecha_sorteo);

  let lateral: React.ReactNode;
  if ((fase === "espera" || fase === "listo") && inscripcion) {
    // Mientras se pueda entrar, el QR manda (y si no hay hora fija, el botón va debajo).
    lateral = (
      <>
        <QrPantalla
          slug={evento.slug}
          ruta={`sorteo/${sorteo.id}`}
          titulo="Escanea y participa"
          texto="Regístrate con tu nombre y correo y ya estarás participando en el sorteo."
        />
        {fase === "listo" && <BotonSortear onClick={realizar} enviando={enviando} participantes={participantes} error={error} />}
      </>
    );
  } else if (fase === "espera" || fase === "listo" || fase === "sorteando") {
    lateral = (
      <>
        <Pildora>Sorteo en vivo</Pildora>
        <Premio sorteo={sorteo} />
        {fase === "listo" && <BotonSortear onClick={realizar} enviando={enviando} participantes={participantes} error={error} />}
      </>
    );
  } else {
    lateral = (
      <>
        <Premio sorteo={sorteo} />
        <Pildora>
          <span aria-hidden className="mr-[1vh]">✓</span>Sorteo finalizado
        </Pildora>
      </>
    );
  }

  const controles =
    fase === "ganador" ? (
      <button
        onClick={() => setCerrado(sorteo.ejecutado_at)}
        className="rounded-full bg-black/50 px-4 py-2 text-white backdrop-blur hover:bg-black/70"
      >
        Finalizar
      </button>
    ) : fase === "fin" ? (
      <button
        onClick={() => setCerrado("")}
        className="rounded-full bg-black/50 px-4 py-2 text-white backdrop-blur hover:bg-black/70"
      >
        Ver ganador otra vez
      </button>
    ) : null;

  return (
    <MarcoPantalla evento={evento} lateral={lateral} controles={controles} fondo={sorteo.imagen || undefined}>
      <div className="flex h-full w-[min(100%,62vw)] max-w-[118vh] flex-col items-center px-[5vh] pb-[5vh] pt-[6vh] text-center">
        <Encabezado titulo={sorteo.titulo} />
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
          {fase === "espera" && <Espera participantes={participantes} restante={restante} />}
          {fase === "listo" && <Listo participantes={participantes} nombres={nombres} />}
          {fase === "sorteando" && tombola && <TombolaEnMarcha tombola={tombola} />}
          {fase === "ganador" && <Ganador sorteo={sorteo} />}
          {fase === "fin" && <Fin sorteo={sorteo} />}
        </div>
      </div>
      {fase === "ganador" && <Confeti />}
    </MarcoPantalla>
  );
}

// "— SORTEO —" y el título, arriba al centro, como en el mockup.
function Encabezado({ titulo }: { titulo: string }) {
  return (
    <header className="w-full drop-shadow-[0_0.4vh_1.6vh_rgba(0,0,0,.35)]">
      <p className="flex items-center justify-center gap-[2vh] text-[2.3vh] font-bold uppercase tracking-[.32em] text-white/90">
        <span aria-hidden className="h-px w-[7vh] bg-white/70" />
        Sorteo
        <span aria-hidden className="h-px w-[7vh] bg-white/70" />
      </p>
      <h1 className="mt-[1.2vh] text-[8vh] font-extrabold leading-[1.02] text-white [text-wrap:balance]">{titulo}</h1>
    </header>
  );
}

function Pildora({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-full bg-[var(--p-fondo)] px-[2.6vh] py-[1.1vh] text-[2vh] font-extrabold uppercase tracking-[.08em] shadow">
      {children}
    </p>
  );
}

function IconoPersonas({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <circle cx="12" cy="7.5" r="3.6" />
      <circle cx="5" cy="9" r="2.6" />
      <circle cx="19" cy="9" r="2.6" />
      <path d="M12 12.6c-3.6 0-6.4 2.1-6.4 4.7V19h12.8v-1.7c0-2.6-2.8-4.7-6.4-4.7ZM5 13.4c-2.3 0-4 1.4-4 3.1V18h3.3v-.7c0-1.5.6-2.8 1.7-3.9H5Zm14 0h-.1c1.1 1.1 1.7 2.4 1.7 3.9v.7H24v-1.5c0-1.7-1.7-3.1-4-3.1Z" />
    </svg>
  );
}

function IconoTrofeo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1ZM6 20h12v2H6v-2Z" />
    </svg>
  );
}

function IconoReloj({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9.5 2.5h5" />
    </svg>
  );
}

// La cifra de participantes, a la izquierda de la píldora blanca.
function Participando({ participantes }: { participantes: number }) {
  return (
    <div className="flex items-center gap-[2vh] pr-[3vh]">
      <IconoPersonas className="h-[7vh] w-[7vh] text-[var(--p-acento)]" />
      <div className="text-left">
        <p className="text-[6.4vh] font-extrabold leading-none tabular-nums text-[var(--p-acento)]">{miles(participantes)}</p>
        <p className="mt-[.6vh] text-[1.6vh] font-bold uppercase leading-tight tracking-[.08em] text-neutral-700">
          {participantes === 1 ? "Persona" : "Personas"}
          <br />
          participando
        </p>
      </div>
    </div>
  );
}

function Espera({ participantes, restante }: { participantes: number; restante: number }) {
  const segundos = Math.ceil(restante / 1000);
  const partes = [
    { valor: Math.floor(segundos / 86400), etiqueta: "Días" },
    { valor: Math.floor((segundos % 86400) / 3600), etiqueta: "Horas" },
    { valor: Math.floor((segundos % 3600) / 60), etiqueta: "Min" },
    { valor: segundos % 60, etiqueta: "Seg" },
  ];
  return (
    <div className="flex items-center rounded-[4vh] bg-white/95 px-[3.4vh] py-[2.4vh] text-neutral-900 shadow-2xl">
      <Participando participantes={participantes} />
      <div className="border-l-2 border-neutral-200 pl-[3vh]">
        <p className="mb-[1.2vh] flex items-center gap-[.8vh] text-[1.6vh] font-bold uppercase tracking-[.08em] text-neutral-700">
          <IconoReloj className="h-[2.2vh] w-[2.2vh]" />
          El sorteo se realiza en:
        </p>
        <div role="timer" aria-label="Tiempo para el sorteo" className="flex gap-[1.2vh]">
          {partes.map((p) => (
            <div key={p.etiqueta} className="text-center">
              <p className="min-w-[8.4vh] rounded-[1.4vh] bg-[color-mix(in_srgb,var(--p-acento)_12%,white)] px-[1vh] py-[1vh] text-[4.6vh] font-extrabold leading-none tabular-nums text-[var(--p-acento)]">
                {String(p.valor).padStart(2, "0")}
              </p>
              <p className="mt-[.7vh] text-[1.3vh] font-bold uppercase tracking-[.1em] text-neutral-500">{p.etiqueta}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Listo({ participantes, nombres }: { participantes: number; nombres: string[] }) {
  // Si la lista no cabe, sube sola en bucle; para eso va dos veces.
  const desfila = nombres.length > 16;
  const lista = desfila ? [...nombres, ...nombres] : nombres;
  const faltan = Math.max(0, participantes - nombres.length);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-[2.6vh] pt-[3vh]">
      <div className="flex items-center rounded-full bg-white/95 py-[1.4vh] pl-[3vh] pr-[1.4vh] text-neutral-900 shadow-2xl">
        <Participando participantes={participantes} />
        <p className="flex items-center gap-[1vh] rounded-full bg-[var(--p-dorado)] px-[2.4vh] py-[1.4vh] text-[2.4vh] font-extrabold text-neutral-950">
          <IconoReloj className="h-[2.6vh] w-[2.6vh]" />
          ¡Es momento del sorteo!
        </p>
      </div>

      <section className="flex min-h-0 w-full flex-1 flex-col rounded-[3vh] bg-white/95 px-[3.4vh] pb-[2.4vh] pt-[2.4vh] text-neutral-900 shadow-2xl">
        <p className="text-[2.6vh] font-extrabold text-[var(--p-acento)]">Participantes del sorteo</p>
        {nombres.length === 0 ? (
          <p className="m-auto text-[2.4vh] text-neutral-500">Todavía no hay participantes.</p>
        ) : (
          <div className="relative mt-[1.8vh] min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_6%,black_94%,transparent)]">
            <ul
              className={`grid grid-cols-2 gap-x-[2vh] gap-y-[1.2vh] text-left ${desfila ? "sorteo-desfile" : "pt-[.6vh]"}`}
              style={desfila ? { animationDuration: `${Math.max(24, nombres.length * 1.1)}s` } : undefined}
            >
              {lista.map((nombre, i) => (
                <li
                  key={i}
                  className="flex items-center gap-[1.2vh] truncate rounded-full bg-[color-mix(in_srgb,var(--p-acento)_8%,white)] px-[1.8vh] py-[1vh] text-[2.2vh] font-semibold"
                >
                  <IconoPersonas className="h-[2.2vh] w-[2.2vh] shrink-0 text-[var(--p-acento)]" />
                  <span className="truncate">{nombre}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {faltan > 0 && (
          <p className="mt-[1.2vh] text-[1.8vh] text-neutral-500">y {miles(faltan)} más en el bombo</p>
        )}
      </section>
    </div>
  );
}

function TombolaEnMarcha({ tombola }: { tombola: Tombola }) {
  const final = tombola.nombre === tombola.ganador && tombola.paso > 0;
  return (
    <div className="w-full">
      <p className="mb-[2.4vh] text-[3.4vh] font-bold text-white drop-shadow">Sorteando…</p>
      <div className="w-full overflow-hidden rounded-[3.4vh] bg-white/95 px-[4vh] py-[6vh] text-[var(--p-acento)] shadow-2xl">
        <p
          key={tombola.paso}
          aria-live="off"
          className={`truncate font-extrabold leading-tight ${final ? "sorteo-ganador text-[10vh]" : "sorteo-tick text-[8.5vh]"}`}
        >
          {tombola.nombre}
        </p>
      </div>
    </div>
  );
}

// Tamaño del nombre según su largo: tiene que leerse desde el fondo del salón
// sin cortarse.
function tamanoNombre(nombre: string, varios: boolean): string {
  if (varios) return nombre.length > 22 ? "text-[4.4vh]" : "text-[5.6vh]";
  if (nombre.length <= 12) return "text-[13vh]";
  if (nombre.length <= 20) return "text-[10.5vh]";
  if (nombre.length <= 30) return "text-[8vh]";
  return "text-[6vh]";
}

function Ganador({ sorteo }: { sorteo: SorteoPantalla }) {
  const varios = sorteo.ganadores.length > 1;
  return (
    <div className="relative mt-[5vh] w-full">
      <span className="absolute left-1/2 top-0 z-10 grid h-[11vh] w-[11vh] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[linear-gradient(160deg,#ffe08a,#e2a521)] text-white shadow-xl ring-[0.8vh] ring-white/80">
        <IconoTrofeo className="h-[6vh] w-[6vh]" />
      </span>
      <div className="w-full rounded-[3.4vh] bg-white/95 px-[4vh] pb-[4vh] pt-[8vh] text-neutral-900 shadow-2xl">
        <p className="text-[4.2vh] font-extrabold leading-tight">
          {varios ? "¡Tenemos ganadores!" : "¡Tenemos un ganador!"}
        </p>
        <div className={`mt-[2vh] ${varios ? "grid grid-cols-2 gap-[1.6vh]" : ""}`}>
          {sorteo.ganadores.map((nombre, i) => (
            <p
              key={`${i}-${nombre}`}
              className={`sorteo-ganador break-words font-extrabold leading-[1.02] text-[var(--p-acento)] [text-wrap:balance] ${tamanoNombre(nombre, varios)} ${
                varios ? "rounded-[2vh] bg-[color-mix(in_srgb,var(--p-acento)_8%,white)] px-[2vh] py-[2vh]" : ""
              }`}
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {nombre}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function Fin({ sorteo }: { sorteo: SorteoPantalla }) {
  return (
    <div className="w-full rounded-[3.4vh] bg-white/95 px-[4vh] py-[5vh] text-neutral-900 shadow-2xl">
      <p className="text-[5.6vh] font-extrabold leading-tight">¡Gracias por participar!</p>
      <p className="mt-[2vh] text-[2.6vh] text-neutral-600">
        {sorteo.ganadores.length > 1 ? "Ganadores" : "Ganador"}:{" "}
        <strong className="text-[var(--p-acento)]">{sorteo.ganadores.join(", ")}</strong>
      </p>
    </div>
  );
}

function Premio({ sorteo }: { sorteo: SorteoPantalla }) {
  return (
    <div className="flex w-full items-center gap-[1.8vh] rounded-[2.2vh] bg-white p-[1.4vh] text-left text-neutral-900 shadow-lg">
      {sorteo.imagen && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sorteo.imagen} alt="" className="aspect-square w-[42%] shrink-0 rounded-[1.6vh] object-cover" />
      )}
      <div className="min-w-0 px-[.6vh]">
        <p className="text-[1.7vh] font-extrabold uppercase tracking-[.12em] text-[var(--p-acento)]">Premio</p>
        <p className="mt-[.4vh] text-[2.7vh] font-extrabold leading-tight [overflow-wrap:anywhere]">
          {sorteo.premio || sorteo.titulo}
        </p>
      </div>
    </div>
  );
}

function BotonSortear({
  onClick,
  enviando,
  participantes,
  error,
}: {
  onClick: () => void;
  enviando: boolean;
  participantes: number;
  error: string;
}) {
  return (
    <div className="w-full">
      <button
        onClick={onClick}
        disabled={enviando || participantes === 0}
        className="flex w-full items-center justify-center gap-[1.4vh] rounded-full bg-[var(--p-rosa)] px-[2vh] py-[2.2vh] text-[2.8vh] font-extrabold text-[var(--p-rosa-texto)] shadow-xl ring-[0.5vh] ring-white/60 transition hover:brightness-110 disabled:opacity-50"
      >
        <IconoTrofeo className="h-[3.2vh] w-[3.2vh]" />
        {enviando ? "Sorteando…" : "Realizar sorteo"}
      </button>
      {participantes === 0 && !error && <p className="mt-[1vh] text-[1.6vh] opacity-60">Esperando participantes</p>}
      {error && (
        <p role="alert" className="mt-[1vh] text-[1.7vh] font-semibold text-[#c8102e]">
          {error}
        </p>
      )}
    </div>
  );
}

// Papel picado: posiciones fijas por índice (nada al azar al dibujar, para
// que el servidor y el navegador pinten lo mismo).
const COLORES_CONFETI = ["var(--p-rosa)", "var(--p-dorado)", "#ffffff", "#ffd166", "#06d6a0", "#4cc9f0"];
function Confeti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 70 }, (_, i) => {
        const izquierda = (i * 37) % 100;
        const duracion = 4.5 + ((i * 7) % 30) / 10;
        const retraso = -((i * 13) % 60) / 10;
        const ancho = 0.9 + ((i * 5) % 9) / 10;
        return (
          <span
            key={i}
            className="sorteo-confeti absolute top-0 block"
            style={{
              left: `${izquierda}%`,
              width: `${ancho}vh`,
              height: `${ancho * (i % 3 === 0 ? 1 : 1.8)}vh`,
              background: COLORES_CONFETI[i % COLORES_CONFETI.length],
              borderRadius: i % 4 === 0 ? "50%" : "2px",
              animationDuration: `${duracion}s`,
              animationDelay: `${retraso}s`,
            }}
          />
        );
      })}
    </div>
  );
}
