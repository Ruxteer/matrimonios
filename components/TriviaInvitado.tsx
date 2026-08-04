"use client";

import { useState } from "react";
import { BotonRosa, Tarjeta } from "./ui";
import { sesionInvitado } from "@/lib/sesion";

export type PreguntaPublica = {
  id: number;
  enunciado: string;
  opciones: string[];
};

// Lo que el servidor le entrega al navegador antes de jugar: sin correctas y
// sin explicación, para que las respuestas no se puedan mirar en el código.
export type TriviaPublica = {
  id: number;
  titulo: string;
  descripcion: string;
  preguntas: PreguntaPublica[];
};

type Detalle = {
  pregunta_id: number;
  correctas: number[];
  acerto: boolean;
  explicacion: string;
};

type Puesto = { participante: string; puntaje: number; total: number };

type Resultado = {
  puntaje: number;
  total: number;
  detalle: Detalle[];
  ranking: Puesto[];
};

export default function TriviaInvitado({
  slug,
  trivias,
}: {
  slug: string;
  trivias: TriviaPublica[];
}) {
  const [elegida, setElegida] = useState<TriviaPublica | null>(
    trivias.length === 1 ? trivias[0] : null
  );
  const [nombre, setNombre] = useState("");
  const [jugando, setJugando] = useState(false);
  const [indice, setIndice] = useState(0);
  const [marcadas, setMarcadas] = useState<Record<number, number[]>>({});
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  function volverAJugar() {
    setIndice(0);
    setMarcadas({});
    setResultado(null);
    setJugando(true);
    setError("");
  }

  function otraTrivia() {
    setElegida(null);
    setIndice(0);
    setMarcadas({});
    setResultado(null);
    setJugando(false);
    setError("");
  }

  function alternar(preguntaId: number, opcion: number) {
    setMarcadas((previas) => {
      const actuales = previas[preguntaId] ?? [];
      return {
        ...previas,
        [preguntaId]: actuales.includes(opcion)
          ? actuales.filter((i) => i !== opcion)
          : [...actuales, opcion],
      };
    });
  }

  async function enviar() {
    if (!elegida) return;
    setEnviando(true);
    setError("");
    const res = await fetch(`/api/eventos/${slug}/trivias/${elegida.id}/jugar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participante: nombre.trim(),
        sesion: sesionInvitado(),
        respuestas: elegida.preguntas.map((p) => ({
          pregunta_id: p.id,
          elegidas: marcadas[p.id] ?? [],
        })),
      }),
    });
    setEnviando(false);
    if (!res.ok) {
      setError("No pudimos enviar tus respuestas. Intenta de nuevo.");
      return;
    }
    setResultado(await res.json());
    setJugando(false);
  }

  if (resultado && elegida) {
    return (
      <ResultadoTrivia
        trivia={elegida}
        resultado={resultado}
        varias={trivias.length > 1}
        onDeNuevo={volverAJugar}
        onOtra={otraTrivia}
      />
    );
  }

  if (!elegida) {
    return (
      <Tarjeta>
        <p className="mb-3 pl-1 font-serif text-sm font-bold leading-snug">
          Elige con cuál quieres jugar
        </p>
        <div className="space-y-2">
          {trivias.map((t) => (
            <button
              key={t.id}
              onClick={() => setElegida(t)}
              className="w-full rounded-[9px] bg-white px-3 py-3 text-left text-[13px] transition hover:brightness-95"
            >
              <span className="block font-bold">{t.titulo}</span>
              <span className="block text-[11px] opacity-60">
                {t.preguntas.length} {t.preguntas.length === 1 ? "pregunta" : "preguntas"}
              </span>
            </button>
          ))}
        </div>
      </Tarjeta>
    );
  }

  // Antes de partir: el nombre (es lo que después aparece en el ranking) y las
  // reglas, que según el módulo van siempre antes de la primera pregunta.
  if (!jugando) {
    return (
      <Tarjeta>
        <p className="mb-1 pl-1 font-serif text-sm font-bold leading-snug">
          {elegida.titulo}
        </p>
        {elegida.descripcion && (
          <p className="mb-3 pl-1 text-[12px] leading-snug opacity-70">
            {elegida.descripcion}
          </p>
        )}
        <p className="mb-3 pl-1 text-[12px] leading-snug opacity-70">
          Son {elegida.preguntas.length}{" "}
          {elegida.preguntas.length === 1 ? "pregunta" : "preguntas"}, una por pantalla.
          Marca lo que creas correcto y al final vas a ver tu puntaje.
        </p>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value.slice(0, 60))}
          placeholder="Tu nombre"
          className="mb-3 w-full rounded-[9px] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-neutral-400"
        />
        {trivias.length > 1 && (
          <button
            onClick={otraTrivia}
            className="mb-3 block w-full text-center text-[11px] underline opacity-60"
          >
            Elegir otra trivia
          </button>
        )}
        <BotonRosa onClick={() => setJugando(true)} disabled={!nombre.trim()}>
          Comenzar
        </BotonRosa>
      </Tarjeta>
    );
  }

  const pregunta = elegida.preguntas[indice];
  const elegidasAhora = marcadas[pregunta.id] ?? [];
  const ultima = indice === elegida.preguntas.length - 1;

  return (
    <Tarjeta>
      <p className="mb-2 pl-1 text-[11px] font-bold uppercase tracking-wide opacity-50">
        Pregunta {indice + 1} de {elegida.preguntas.length}
      </p>
      <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white">
        <div
          className="h-full bg-rosa transition-all"
          style={{ width: `${((indice + 1) / elegida.preguntas.length) * 100}%` }}
        />
      </div>

      <p className="mb-3 pl-1 font-serif text-sm font-bold leading-snug">
        {pregunta.enunciado}
      </p>

      <div className="mb-2 space-y-2">
        {pregunta.opciones.map((opcion, i) => {
          const activa = elegidasAhora.includes(i);
          return (
            <button
              key={i}
              onClick={() => alternar(pregunta.id, i)}
              aria-pressed={activa}
              className={`w-full rounded-[9px] px-3 py-3 text-left text-[13px] leading-snug transition hover:brightness-95 ${
                activa ? "bg-rosa font-bold text-rosa-texto" : "bg-white"
              }`}
            >
              {opcion}
            </button>
          );
        })}
      </div>

      <p className="mb-3 pl-1 text-[11px] opacity-50">Puedes marcar más de una.</p>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      <BotonRosa
        onClick={() => (ultima ? enviar() : setIndice(indice + 1))}
        disabled={!elegidasAhora.length || enviando}
      >
        {ultima ? (enviando ? "Calculando…" : "Ver mi resultado") : "Siguiente"}
      </BotonRosa>
      {indice > 0 && (
        <button
          onClick={() => setIndice(indice - 1)}
          className="mt-2 block w-full text-center text-[11px] underline opacity-60"
        >
          Volver a la anterior
        </button>
      )}
    </Tarjeta>
  );
}

function ResultadoTrivia({
  trivia,
  resultado,
  varias,
  onDeNuevo,
  onOtra,
}: {
  trivia: TriviaPublica;
  resultado: Resultado;
  varias: boolean;
  onDeNuevo: () => void;
  onOtra: () => void;
}) {
  const porPregunta = new Map(resultado.detalle.map((d) => [d.pregunta_id, d]));

  return (
    <div className="space-y-4">
      <Tarjeta className="px-6 py-8 text-center">
        <p className="font-serif text-2xl font-bold">
          {resultado.puntaje} de {resultado.total}
        </p>
        <p className="mt-1 text-sm opacity-70">
          {resultado.puntaje === resultado.total
            ? "¡Perfecto! Conoces a los novios como nadie."
            : resultado.puntaje === 0
              ? "Hoy no era tu día: vuelve a intentarlo."
              : "¡Bien! Todavía queda algo por descubrir."}
        </p>
      </Tarjeta>

      <Tarjeta>
        <p className="mb-3 pl-1 font-serif text-sm font-bold">Cómo te fue</p>
        <ul className="space-y-3">
          {trivia.preguntas.map((p) => {
            const detalle = porPregunta.get(p.id);
            const correctas = detalle?.correctas ?? [];
            return (
              <li key={p.id} className="rounded-[9px] bg-white px-3 py-2">
                <p className="text-[12px] font-bold leading-snug">
                  <span className={detalle?.acerto ? "text-emerald-600" : "text-rose-500"}>
                    {detalle?.acerto ? "✓" : "✗"}
                  </span>{" "}
                  {p.enunciado}
                </p>
                <p className="mt-1 text-[11px] opacity-70">
                  {correctas.length === 1 ? "Respuesta: " : "Respuestas: "}
                  {correctas.map((i) => p.opciones[i]).filter(Boolean).join(" · ")}
                </p>
                {detalle?.explicacion && (
                  <p className="mt-1 text-[11px] italic opacity-60">{detalle.explicacion}</p>
                )}
              </li>
            );
          })}
        </ul>
      </Tarjeta>

      {resultado.ranking.length > 0 && (
        <Tarjeta>
          <p className="mb-3 pl-1 font-serif text-sm font-bold">Los que más saben</p>
          <ol className="space-y-1">
            {resultado.ranking.map((puesto, i) => (
              <li
                key={`${puesto.participante}-${i}`}
                className="flex items-center gap-2 rounded-[9px] bg-white px-3 py-2 text-[12px]"
              >
                <span className="w-4 shrink-0 text-center font-bold opacity-40">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{puesto.participante}</span>
                <span className="shrink-0 font-bold">
                  {puesto.puntaje}/{puesto.total}
                </span>
              </li>
            ))}
          </ol>
        </Tarjeta>
      )}

      <Tarjeta>
        <BotonRosa onClick={onDeNuevo}>Jugar de nuevo</BotonRosa>
        {varias && (
          <button
            onClick={onOtra}
            className="mt-2 block w-full text-center text-[11px] underline opacity-60"
          >
            Elegir otra trivia
          </button>
        )}
      </Tarjeta>
    </div>
  );
}
