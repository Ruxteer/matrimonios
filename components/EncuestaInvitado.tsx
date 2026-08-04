"use client";

import { useState } from "react";
import { BotonRosa, Tarjeta } from "./ui";
import { sesionInvitado } from "@/lib/sesion";
import type { TipoPregunta } from "@/lib/db";

export type PreguntaPublica = {
  id: number;
  texto: string;
  tipo: TipoPregunta;
  /** Ya viene leído desde el servidor para no repetir el JSON.parse aquí. */
  opciones: string[];
  obligatoria: number;
};

export type EncuestaPublica = {
  id: number;
  titulo: string;
  descripcion: string;
  mensaje_final: string;
  pide_nombre: number;
  preguntas: PreguntaPublica[];
};

type Valor = string | string[];

function vacio(valor: Valor | undefined): boolean {
  if (Array.isArray(valor)) return valor.length === 0;
  return !valor || !valor.trim();
}

export default function EncuestaInvitado({
  slug,
  encuestas,
}: {
  slug: string;
  encuestas: EncuestaPublica[];
}) {
  // Con una sola encuesta no hay nada que elegir: se muestra el formulario de
  // entrada. Con varias, se abre una sin cambiar de dirección.
  const [abiertaId, setAbiertaId] = useState<number | null>(
    encuestas.length === 1 ? encuestas[0].id : null
  );
  const abierta = encuestas.find((e) => e.id === abiertaId);

  if (abierta) {
    return (
      <>
        <Formulario key={abierta.id} slug={slug} encuesta={abierta} />
        {encuestas.length > 1 && (
          <button
            onClick={() => setAbiertaId(null)}
            className="mx-auto mt-3 block text-xs underline opacity-60"
          >
            Ver las otras encuestas
          </button>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {encuestas.map((e) => (
        <Tarjeta key={e.id}>
          <div className="mb-3 pl-1">
            <p className="font-serif text-sm font-bold leading-snug">{e.titulo}</p>
            {e.descripcion && (
              <p className="mt-1 text-[12px] leading-snug opacity-70">{e.descripcion}</p>
            )}
          </div>
          <BotonRosa onClick={() => setAbiertaId(e.id)}>Responder</BotonRosa>
        </Tarjeta>
      ))}
    </div>
  );
}

function Formulario({ slug, encuesta }: { slug: string; encuesta: EncuestaPublica }) {
  const [nombre, setNombre] = useState("");
  const [valores, setValores] = useState<Record<number, Valor>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [final, setFinal] = useState("");

  function poner(id: number, valor: Valor) {
    setValores((v) => ({ ...v, [id]: valor }));
  }

  function alternar(id: number, opcion: string) {
    setValores((v) => {
      const actual = Array.isArray(v[id]) ? (v[id] as string[]) : [];
      return {
        ...v,
        [id]: actual.includes(opcion)
          ? actual.filter((o) => o !== opcion)
          : [...actual, opcion],
      };
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const falta = encuesta.preguntas.find(
      (p) => p.obligatoria === 1 && vacio(valores[p.id])
    );
    if (falta) {
      setError(`Te falta responder: ${falta.texto}`);
      return;
    }
    setEnviando(true);
    const res = await fetch(`/api/eventos/${slug}/encuestas/${encuesta.id}/respuestas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participante: nombre,
        sesion: sesionInvitado(),
        valores: encuesta.preguntas
          .filter((p) => !vacio(valores[p.id]))
          .map((p) => ({ pregunta_id: p.id, valor: valores[p.id] })),
      }),
    });
    setEnviando(false);
    if (res.ok) {
      setFinal(encuesta.mensaje_final || "¡Gracias!");
      return;
    }
    if (res.status === 409) {
      setFinal("Ya respondiste esta encuesta");
      return;
    }
    setError("No pudimos enviar tus respuestas. Intenta de nuevo.");
  }

  if (final) {
    return (
      <Tarjeta className="px-6 py-10 text-center">
        <p className="whitespace-pre-line font-serif text-lg font-bold leading-snug">
          {final}
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <form onSubmit={enviar}>
        <div className="mb-3 pl-1">
          <p className="font-serif text-sm font-bold leading-snug">{encuesta.titulo}</p>
          {encuesta.descripcion && (
            <p className="mt-1 text-[12px] leading-snug opacity-70">
              {encuesta.descripcion}
            </p>
          )}
        </div>

        {encuesta.pide_nombre === 1 && (
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
            className="mb-4 w-full rounded-[9px] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-neutral-400"
          />
        )}

        <div className="space-y-4">
          {encuesta.preguntas.map((p) => (
            <div key={p.id}>
              <p className="mb-1.5 pl-1 font-serif text-[13px] font-bold leading-snug">
                {p.texto}
                {p.obligatoria === 1 && <span className="opacity-50"> *</span>}
              </p>
              <Pregunta
                pregunta={p}
                valor={valores[p.id]}
                poner={poner}
                alternar={alternar}
              />
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-[12px] leading-snug text-rose-600">{error}</p>}
        <BotonRosa type="submit" disabled={enviando} className="mt-4">
          {enviando ? "Enviando…" : "Enviar respuestas"}
        </BotonRosa>
      </form>
    </Tarjeta>
  );
}

const CAMPO =
  "w-full rounded-[9px] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-neutral-400";
const FILA = "flex items-center gap-2 rounded-[9px] bg-white px-3 py-2 text-[13px]";

function Pregunta({
  pregunta,
  valor,
  poner,
  alternar,
}: {
  pregunta: PreguntaPublica;
  valor: Valor | undefined;
  poner: (id: number, valor: Valor) => void;
  alternar: (id: number, opcion: string) => void;
}) {
  const elegidas = Array.isArray(valor) ? valor : [];

  switch (pregunta.tipo) {
    case "parrafo":
      return (
        <textarea
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => poner(pregunta.id, e.target.value.slice(0, 1000))}
          rows={4}
          placeholder="Escribe tu respuesta…"
          className={`resize-none ${CAMPO}`}
        />
      );

    case "unica":
      return (
        <div className="space-y-1.5">
          {pregunta.opciones.map((o) => (
            <label key={o} className={FILA}>
              <input
                type="radio"
                name={`pregunta-${pregunta.id}`}
                checked={valor === o}
                onChange={() => poner(pregunta.id, o)}
                className="accent-rosa"
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
      );

    case "multiple":
      return (
        <div className="space-y-1.5">
          {pregunta.opciones.map((o) => (
            <label key={o} className={FILA}>
              <input
                type="checkbox"
                checked={elegidas.includes(o)}
                onChange={() => alternar(pregunta.id, o)}
                className="accent-rosa"
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
      );

    case "escala":
      return (
        <div className="flex justify-between gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => poner(pregunta.id, String(n))}
              className={`h-10 flex-1 rounded-full text-[13px] font-bold transition ${
                valor === String(n) ? "bg-rosa text-rosa-texto" : "bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      );

    case "si_no":
      return (
        <div className="flex gap-2">
          {[
            ["si", "Sí"],
            ["no", "No"],
          ].map(([clave, texto]) => (
            <button
              key={clave}
              type="button"
              onClick={() => poner(pregunta.id, clave)}
              className={`flex-1 rounded-[9px] py-2 text-[13px] font-bold transition ${
                valor === clave ? "bg-rosa text-rosa-texto" : "bg-white"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      );

    default:
      return (
        <input
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => poner(pregunta.id, e.target.value.slice(0, 300))}
          placeholder="Escribe tu respuesta…"
          className={CAMPO}
        />
      );
  }
}
