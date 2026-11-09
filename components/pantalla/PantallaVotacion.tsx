"use client";

import { useEffect, useState } from "react";
import MarcoPantalla, { QrPantalla } from "./MarcoPantalla";
import type { EventoPantalla } from "@/components/PantallaSalon";
import type { VotacionPantalla } from "@/lib/votaciones";

const CADA = 3000; // los votos se ven casi al instante

// La votación proyectada: cada alternativa con su foto, su barra y su
// porcentaje, en el orden que eligió el organizador (que las filas salten de
// lugar con cada voto marea). La que va ganando se destaca.
export default function PantallaVotacion({
  evento,
  inicial,
  clave,
}: {
  evento: EventoPantalla;
  inicial: VotacionPantalla;
  clave: string;
}) {
  const [votacion, setVotacion] = useState(inicial);

  useEffect(() => {
    let vivo = true;
    const url = `/api/eventos/${evento.slug}/votaciones/${inicial.id}/pantalla?k=${encodeURIComponent(clave)}`;
    const tarea = window.setInterval(async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok && vivo) setVotacion(await res.json());
      } catch {
        // Sin conexión un momento: se queda con lo último y vuelve a intentar.
      }
    }, CADA);
    return () => {
      vivo = false;
      window.clearInterval(tarea);
    };
  }, [evento.slug, inicial.id, clave]);

  const { opciones, total } = votacion;
  const maximo = Math.max(0, ...opciones.map((o) => o.votos));
  const conImagen = opciones.some((o) => o.imagen);
  // Con fotos y pocas alternativas, cada una es una tarjeta grande con su foto
  // (como en el mockup); si no, filas con la barra de resultados.
  const tarjetas = conImagen && opciones.length >= 2 && opciones.length <= 4;
  const dosColumnas = !tarjetas && opciones.length > 5;
  const porcentaje = (votos: number) => (total ? Math.round((votos * 100) / total) : 0);

  return (
    <MarcoPantalla
      evento={evento}
      lateral={
        votacion.abierta ? (
          <QrPantalla
            slug={evento.slug}
            ruta="votacion"
            titulo="Escanea y vota"
            texto="Elige tu favorito desde tu teléfono y mira cómo se mueven los resultados."
          />
        ) : (
          <div className="w-full rounded-[2vh] bg-[var(--p-fondo)] px-[2vh] py-[3vh]">
            <p className="text-[2.2vh] font-bold uppercase tracking-[.12em] opacity-60">Votación</p>
            <p className="mt-[1vh] text-[4vh] font-extrabold leading-tight">Cerrada</p>
            <p className="mt-[1vh] text-[1.9vh] opacity-70">Gracias por participar</p>
          </div>
        )
      }
    >
      <div className="flex h-full flex-col px-[6vh] pb-[4vh] pt-[6vh]">
        <header className="mx-auto mb-[4vh] max-w-[90%] text-center drop-shadow-[0_0.4vh_1.6vh_rgba(0,0,0,.35)]">
          <p className="flex items-center justify-center gap-[2vh] text-[2.3vh] font-bold uppercase tracking-[.32em] text-white/90">
            <span aria-hidden className="h-px w-[7vh] bg-white/70" />
            Votación
            <span aria-hidden className="h-px w-[7vh] bg-white/70" />
          </p>
          <h1 className="mt-[1.2vh] text-[7vh] font-extrabold leading-[1.04] [text-wrap:balance]">{votacion.titulo}</h1>
          {votacion.descripcion && <p className="mt-[1.2vh] text-[2.6vh] text-white/85">{votacion.descripcion}</p>}
        </header>

        {tarjetas ? (
          <ol className="mx-auto flex min-h-0 w-full flex-1 items-stretch justify-center gap-[3vh]">
            {opciones.map((o) => {
              const lider = maximo > 0 && o.votos === maximo;
              return (
                <li key={o.id} className="flex min-h-0 max-w-[46vh] flex-1 flex-col">
                  <div
                    className={`relative min-h-0 flex-1 overflow-hidden rounded-[3vh] border-[0.7vh] bg-white/10 shadow-2xl transition-colors duration-500 ${
                      lider ? "border-[var(--p-dorado)]" : "border-white"
                    }`}
                  >
                    {o.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.imagen} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden className="absolute inset-0 grid place-items-center text-[12vh] font-extrabold text-white/40">
                        {o.texto.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <p
                      className={`absolute inset-x-[2vh] bottom-[2vh] line-clamp-2 rounded-[2.4vh] bg-[var(--p-rosa)] px-[2vh] py-[1.2vh] text-center font-extrabold leading-tight text-[var(--p-rosa-texto)] shadow-lg [overflow-wrap:anywhere] ${
                        opciones.length > 3 ? "text-[2.6vh]" : "text-[3vh]"
                      }`}
                    >
                      {o.texto}
                    </p>
                  </div>
                  <div className="mt-[2vh] flex items-center gap-[1.6vh]">
                    <div className="h-[1.8vh] flex-1 overflow-hidden rounded-full bg-white/20">
                      <div
                        className={`h-full rounded-full transition-[width] duration-700 ease-out ${lider ? "bg-[var(--p-dorado)]" : "bg-white"}`}
                        style={{ width: `${porcentaje(o.votos)}%` }}
                      />
                    </div>
                    <p className="text-[4vh] font-extrabold tabular-nums">{porcentaje(o.votos)}%</p>
                  </div>
                  <p className="text-[1.9vh] tabular-nums text-white/65">
                    {o.votos} {o.votos === 1 ? "voto" : "votos"}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <ol
            className={`grid min-h-0 flex-1 content-center gap-x-[4vh] gap-y-[2vh] ${
              dosColumnas ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {opciones.map((o) => {
              const lider = maximo > 0 && o.votos === maximo;
              return (
                <li
                  key={o.id}
                  className={`flex items-center gap-[2.4vh] rounded-[2.2vh] p-[1.4vh] pr-[2.6vh] transition-colors duration-500 ${
                    lider ? "bg-white text-neutral-950 shadow-2xl" : "bg-white/10 text-white"
                  }`}
                >
                  {conImagen && (
                    <div
                      className={`grid shrink-0 place-items-center overflow-hidden rounded-[1.6vh] bg-black/10 ${
                        dosColumnas ? "h-[9vh] w-[9vh]" : "h-[11vh] w-[11vh]"
                      }`}
                    >
                      {o.imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.imagen} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span aria-hidden className="text-[4vh] font-extrabold opacity-40">
                          {o.texto.trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-[2vh]">
                      <p className="truncate text-[3.2vh] font-bold">{o.texto}</p>
                      <p className="shrink-0 text-[3.6vh] font-extrabold tabular-nums">{porcentaje(o.votos)}%</p>
                    </div>
                    <div
                      className={`mt-[1.2vh] h-[1.6vh] overflow-hidden rounded-full ${
                        lider ? "bg-neutral-200" : "bg-white/15"
                      }`}
                    >
                      <div
                        className="h-full rounded-full bg-[var(--p-rosa)] transition-[width] duration-700 ease-out"
                        style={{ width: `${porcentaje(o.votos)}%` }}
                      />
                    </div>
                    <p className={`mt-[.8vh] text-[1.9vh] tabular-nums ${lider ? "text-neutral-500" : "text-white/60"}`}>
                      {o.votos} {o.votos === 1 ? "voto" : "votos"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-[3vh] text-center text-[2.2vh] font-semibold text-white/75 tabular-nums">
          {votacion.votantes === 0
            ? "Sé el primero en votar"
            : `${votacion.votantes} ${votacion.votantes === 1 ? "persona votó" : "personas votaron"}`}
        </p>
      </div>
    </MarcoPantalla>
  );
}
