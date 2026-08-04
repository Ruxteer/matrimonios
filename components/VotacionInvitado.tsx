"use client";

import { useEffect, useState } from "react";
import { BotonRosa, Tarjeta } from "./ui";
import { sesionInvitado } from "@/lib/sesion";
import { urlArchivo } from "@/lib/urls";
import type { OpcionVotacion, Votacion } from "@/lib/db";

export type OpcionPublica = OpcionVotacion & { votos?: number };

export type VotacionPublica = Votacion & {
  opciones: OpcionPublica[];
  /** Los conteos solo llegan cuando la votación los muestra. */
  total?: number;
  votada: boolean;
  /** Lo que eligió este teléfono, para marcárselo en los resultados. */
  elegidas: number[];
};

export default function VotacionInvitado({
  slug,
  inicial,
}: {
  slug: string;
  inicial: VotacionPublica[];
}) {
  const [votaciones, setVotaciones] = useState(inicial);
  const [seleccion, setSeleccion] = useState<Record<number, number[]>>({});
  const [enviando, setEnviando] = useState(0);
  const [errores, setErrores] = useState<Record<number, string>>({});

  // La sesión vive en el teléfono, así que el servidor no sabe al pintar la
  // página en cuáles ya votó: se le pregunta apenas carga.
  useEffect(() => {
    const sesion = sesionInvitado();
    if (!sesion) return;
    fetch(`/api/eventos/${slug}/votaciones?sesion=${encodeURIComponent(sesion)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((datos: VotacionPublica[] | null) => datos && setVotaciones(datos))
      .catch(() => {});
  }, [slug]);

  function elegir(v: VotacionPublica, opcion: number) {
    setSeleccion((s) => {
      const actual = s[v.id] ?? [];
      if (!v.multiple) return { ...s, [v.id]: [opcion] };
      return {
        ...s,
        [v.id]: actual.includes(opcion)
          ? actual.filter((o) => o !== opcion)
          : [...actual, opcion],
      };
    });
  }

  async function votar(v: VotacionPublica) {
    const elegidas = seleccion[v.id] ?? [];
    if (!elegidas.length) {
      setErrores((e) => ({ ...e, [v.id]: "Elige una alternativa para votar." }));
      return;
    }
    setEnviando(v.id);
    const res = await fetch(`/api/eventos/${slug}/votaciones/${v.id}/votar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opciones: elegidas, sesion: sesionInvitado() }),
    });
    const datos = await res.json().catch(() => null);
    setEnviando(0);

    if (res.ok) {
      setVotaciones((vs) => vs.map((x) => (x.id === v.id ? datos : x)));
      setErrores((e) => ({ ...e, [v.id]: "" }));
      return;
    }
    // 409: este teléfono ya había votado (por ejemplo, en otra pestaña).
    if (res.status === 409) {
      setVotaciones((vs) => vs.map((x) => (x.id === v.id ? { ...x, votada: true } : x)));
    }
    setErrores((e) => ({ ...e, [v.id]: datos?.error ?? "No pudimos registrar tu voto." }));
  }

  return (
    <div className="space-y-4">
      {votaciones.map((v) => {
        const elegidas = seleccion[v.id] ?? [];
        const error = errores[v.id];
        return (
          <Tarjeta key={v.id}>
            <p className="mb-1 pl-1 font-serif text-sm font-bold leading-snug">{v.titulo}</p>
            {v.descripcion && (
              <p className="mb-3 pl-1 text-[12px] leading-snug opacity-70">{v.descripcion}</p>
            )}

            {v.votada ? (
              <Resultados votacion={v} />
            ) : (
              <>
                <div className="mb-3 space-y-2">
                  {v.opciones.map((o) => {
                    const marcada = elegidas.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => elegir(v, o.id)}
                        aria-pressed={marcada}
                        className={`flex w-full items-center gap-3 rounded-[10px] border p-2 text-left text-[13px] transition ${
                          marcada
                            ? "border-rosa bg-rosa-suave font-bold"
                            : "border-transparent bg-white"
                        }`}
                      >
                        {/* La marca va a la izquierda, como en las encuestas: es
                            la misma decisión para el invitado. */}
                        <span
                          className={`h-4 w-4 shrink-0 border ${
                            v.multiple ? "rounded-[4px]" : "rounded-full"
                          } ${marcada ? "border-rosa bg-rosa" : "border-neutral-300 bg-white"}`}
                        />
                        {o.imagen && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={urlArchivo(o.imagen)}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-[8px] object-cover"
                          />
                        )}
                        <span className="flex-1 leading-snug">{o.texto}</span>
                      </button>
                    );
                  })}
                </div>

                {v.multiple === 1 && (
                  <p className="mb-2 pl-1 text-[11px] opacity-60">
                    Puedes elegir más de una alternativa.
                  </p>
                )}
                {error && <p className="mb-2 text-[12px] text-rose-600">{error}</p>}
                <BotonRosa onClick={() => votar(v)} disabled={enviando === v.id}>
                  {enviando === v.id ? "Enviando…" : "Votar"}
                </BotonRosa>
              </>
            )}
          </Tarjeta>
        );
      })}
    </div>
  );
}

function Resultados({ votacion }: { votacion: VotacionPublica }) {
  const total = votacion.total;

  // Sin conteos hay dos motivos: esta votación nunca los muestra o todavía no
  // se cierra. En los dos casos el invitado ya cumplió su parte.
  if (total === undefined) {
    return (
      <div className="rounded-[10px] bg-white px-4 py-8 text-center">
        <p className="font-serif text-base font-bold">¡Gracias por votar!</p>
        {votacion.resultados === "al_cerrar" && (
          <p className="mt-1 text-[12px] opacity-70">
            Los resultados se muestran cuando cierre la votación.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-center font-serif text-sm font-bold">¡Gracias por votar!</p>
      <div className="space-y-2">
        {votacion.opciones.map((o) => {
          const votos = o.votos ?? 0;
          const porcentaje = total ? Math.round((votos * 100) / total) : 0;
          const mia = votacion.elegidas.includes(o.id);
          return (
            <div key={o.id} className="rounded-[10px] bg-white p-2">
              <div className="mb-1.5 flex items-baseline gap-2 text-[13px]">
                <span className={`flex-1 leading-snug ${mia ? "font-bold" : ""}`}>
                  {o.texto}
                  {mia && " ✓"}
                </span>
                <span className="text-[12px] font-bold">{porcentaje}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gris-card">
                <div className="h-full rounded-full bg-rosa" style={{ width: `${porcentaje}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] opacity-60">
        {total} {total === 1 ? "voto" : "votos"} en total
      </p>
    </div>
  );
}
