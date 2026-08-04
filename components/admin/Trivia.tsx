"use client";

import { useCallback, useEffect, useState } from "react";

type Puesto = { participante: string; puntaje: number; total: number };

type PreguntaApi = {
  id: number;
  enunciado: string;
  opciones: string[];
  correctas: number[];
  explicacion: string;
};

type TriviaApi = {
  id: number;
  titulo: string;
  descripcion: string;
  abierta: number;
  orden: number;
  preguntas: PreguntaApi[];
  partidas: number;
  promedio: number;
  ranking: Puesto[];
};

// En el panel las preguntas se editan antes de existir en la base: `clave` es
// para React y el id 0 marca las que todavía no se guardaron.
type PreguntaEditable = PreguntaApi & { clave: string };
type TriviaEditable = Omit<TriviaApi, "preguntas"> & { preguntas: PreguntaEditable[] };

let contador = 0;

function editable(t: TriviaApi): TriviaEditable {
  return { ...t, preguntas: t.preguntas.map((p) => ({ ...p, clave: `p${p.id}` })) };
}

function preguntaNueva(): PreguntaEditable {
  return {
    clave: `nueva${++contador}`,
    id: 0,
    enunciado: "",
    opciones: ["", ""],
    correctas: [],
    explicacion: "",
  };
}

export default function Trivia({ slug }: { slug: string }) {
  const [trivias, setTrivias] = useState<TriviaEditable[]>([]);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState("");

  const cargar = useCallback(() => {
    fetch(`/api/eventos/${slug}/trivias`).then(async (res) => {
      if (!res.ok) {
        setEstado("No pudimos cargar las trivias.");
        setCargando(false);
        return;
      }
      const datos: TriviaApi[] = await res.json();
      setTrivias(datos.map(editable));
      setCargando(false);
    });
  }, [slug]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function cambiar(id: number, cambios: Partial<TriviaEditable>) {
    setTrivias((ts) => ts.map((t) => (t.id === id ? { ...t, ...cambios } : t)));
  }

  function cambiarPreguntas(
    id: number,
    f: (ps: PreguntaEditable[]) => PreguntaEditable[]
  ) {
    setTrivias((ts) => ts.map((t) => (t.id === id ? { ...t, preguntas: f(t.preguntas) } : t)));
  }

  function editarPregunta(id: number, clave: string, cambios: Partial<PreguntaEditable>) {
    cambiarPreguntas(id, (ps) =>
      ps.map((p) => (p.clave === clave ? { ...p, ...cambios } : p))
    );
  }

  function moverPregunta(id: number, desde: number, hacia: number) {
    cambiarPreguntas(id, (ps) => {
      if (hacia < 0 || hacia >= ps.length) return ps;
      const nuevas = [...ps];
      [nuevas[desde], nuevas[hacia]] = [nuevas[hacia], nuevas[desde]];
      return nuevas;
    });
  }

  // Al borrar una alternativa hay que correr los índices marcados, si no la
  // respuesta correcta pasa a apuntar a otra cosa.
  function quitarOpcion(id: number, pregunta: PreguntaEditable, i: number) {
    editarPregunta(id, pregunta.clave, {
      opciones: pregunta.opciones.filter((_, j) => j !== i),
      correctas: pregunta.correctas
        .filter((c) => c !== i)
        .map((c) => (c > i ? c - 1 : c)),
    });
  }

  async function crear() {
    const titulo = prompt("Título de la trivia:", "¿Cuánto conoces a los novios?");
    if (!titulo?.trim()) return;
    setEstado("Creando…");
    const res = await fetch(`/api/eventos/${slug}/trivias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    });
    if (!res.ok) {
      setEstado("No pudimos crear la trivia.");
      return;
    }
    const creada: TriviaApi = await res.json();
    setTrivias((ts) => [...ts, { ...editable(creada), preguntas: [preguntaNueva()] }]);
    setEstado("Trivia creada: agrégale preguntas y guárdala.");
  }

  async function guardar(t: TriviaEditable) {
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${slug}/trivias/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: t.titulo,
        descripcion: t.descripcion,
        preguntas: t.preguntas.map(({ id, enunciado, opciones, correctas, explicacion }) => ({
          id,
          enunciado,
          opciones,
          correctas,
          explicacion,
        })),
      }),
    });
    if (!res.ok) {
      setEstado("No pudimos guardar la trivia.");
      return;
    }
    const guardada: TriviaApi = await res.json();
    setTrivias((ts) => ts.map((x) => (x.id === t.id ? editable(guardada) : x)));
    setEstado("Guardado");
  }

  async function alternarAbierta(t: TriviaEditable) {
    const abierta = t.abierta ? 0 : 1;
    const res = await fetch(`/api/eventos/${slug}/trivias/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ abierta }),
    });
    if (!res.ok) {
      setEstado("No pudimos cambiar el estado de la trivia.");
      return;
    }
    cambiar(t.id, { abierta });
    setEstado(abierta ? "Trivia abierta: ya se puede jugar." : "Trivia cerrada.");
  }

  async function eliminar(t: TriviaEditable) {
    if (!confirm(`¿Eliminar "${t.titulo}"? Se borran sus preguntas y las partidas jugadas.`))
      return;
    const res = await fetch(`/api/eventos/${slug}/trivias/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      setEstado("No pudimos eliminar la trivia.");
      return;
    }
    setTrivias((ts) => ts.filter((x) => x.id !== t.id));
    setEstado("Trivia eliminada.");
  }

  if (cargando) return <p className="text-sm text-neutral-500">Cargando…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="mb-1 font-medium">Trivia</h2>
          <p className="text-sm text-neutral-500">
            Preguntas con alternativas para los invitados. Solo se juegan las trivias
            abiertas, y las respuestas correctas nunca salen del servidor antes de que el
            invitado responda.
          </p>
        </div>
        <button
          onClick={crear}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          + Nueva trivia
        </button>
      </div>

      {trivias.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
          Todavía no hay trivias. Crea una y agrégale preguntas.
        </p>
      )}

      {trivias.map((t) => (
        <section key={t.id} className="space-y-4 rounded-xl border border-neutral-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={t.titulo}
              onChange={(e) => cambiar(t.id, { titulo: e.target.value })}
              placeholder="Título de la trivia"
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-medium"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={t.abierta === 1}
                onChange={() => alternarAbierta(t)}
                className="h-4 w-4"
              />
              {t.abierta ? "Abierta" : "Cerrada"}
            </label>
            <button
              onClick={() => eliminar(t)}
              className="text-sm text-neutral-400 hover:text-rose-600"
              title="Eliminar trivia"
            >
              ✕
            </button>
          </div>

          <input
            value={t.descripcion}
            onChange={(e) => cambiar(t.id, { descripcion: e.target.value })}
            placeholder="Descripción o instrucciones (opcional)"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />

          <ul className="space-y-4">
            {t.preguntas.map((p, i) => (
              <li key={p.clave} className="rounded-lg border border-neutral-200 p-3">
                <div className="mb-2 flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-center text-sm tabular-nums text-neutral-400">
                    {i + 1}
                  </span>
                  <input
                    value={p.enunciado}
                    onChange={(e) =>
                      editarPregunta(t.id, p.clave, { enunciado: e.target.value })
                    }
                    placeholder="¿Dónde se conocieron los novios?"
                    className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => moverPregunta(t.id, i, i - 1)}
                      disabled={i === 0}
                      aria-label="Subir pregunta"
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moverPregunta(t.id, i, i + 1)}
                      disabled={i === t.preguntas.length - 1}
                      aria-label="Bajar pregunta"
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() =>
                        cambiarPreguntas(t.id, (ps) =>
                          ps.filter((x) => x.clave !== p.clave)
                        )
                      }
                      aria-label="Eliminar pregunta"
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-50 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pl-7">
                  {p.opciones.map((opcion, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <label
                        className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-neutral-500"
                        title="Marcar como correcta"
                      >
                        <input
                          type="checkbox"
                          checked={p.correctas.includes(j)}
                          onChange={() =>
                            editarPregunta(t.id, p.clave, {
                              correctas: p.correctas.includes(j)
                                ? p.correctas.filter((c) => c !== j)
                                : [...p.correctas, j],
                            })
                          }
                          className="h-4 w-4"
                        />
                        correcta
                      </label>
                      <input
                        value={opcion}
                        onChange={(e) =>
                          editarPregunta(t.id, p.clave, {
                            opciones: p.opciones.map((o, k) =>
                              k === j ? e.target.value : o
                            ),
                          })
                        }
                        placeholder={`Alternativa ${j + 1}`}
                        className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => quitarOpcion(t.id, p, j)}
                        disabled={p.opciones.length <= 2}
                        aria-label="Quitar alternativa"
                        className="shrink-0 text-neutral-400 hover:text-rose-600 disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() =>
                        editarPregunta(t.id, p.clave, { opciones: [...p.opciones, ""] })
                      }
                      disabled={p.opciones.length >= 8}
                      className="rounded-lg border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50 disabled:opacity-30"
                    >
                      + Alternativa
                    </button>
                    {p.correctas.length === 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        falta marcar la respuesta correcta
                      </span>
                    )}
                    {p.correctas.length > 1 && (
                      <span className="text-xs text-neutral-500">
                        hay que marcarlas todas para acertar
                      </span>
                    )}
                  </div>

                  <input
                    value={p.explicacion}
                    onChange={(e) =>
                      editarPregunta(t.id, p.clave, { explicacion: e.target.value })
                    }
                    placeholder="Explicación que se muestra al final (opcional)"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => cambiarPreguntas(t.id, (ps) => [...ps, preguntaNueva()])}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
            >
              + Agregar pregunta
            </button>
            <button
              onClick={() => guardar(t)}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
            >
              Guardar trivia
            </button>
            <span className="text-xs text-neutral-400">
              Las preguntas sin enunciado o con menos de dos alternativas no se guardan.
            </span>
          </div>

          <div className="rounded-lg bg-neutral-50 p-3">
            <p className="text-sm text-neutral-600">
              {t.partidas} {t.partidas === 1 ? "partida jugada" : "partidas jugadas"}
              {t.partidas > 0 && ` · puntaje promedio ${t.promedio} de ${t.preguntas.length}`}
            </p>
            {t.ranking.length > 0 && (
              <ol className="mt-2 space-y-1">
                {t.ranking.map((puesto, i) => (
                  <li
                    key={`${puesto.participante}-${i}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="w-5 text-center tabular-nums text-neutral-400">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{puesto.participante}</span>
                    <span className="tabular-nums text-neutral-600">
                      {puesto.puntaje}/{puesto.total}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ))}

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}
    </div>
  );
}
