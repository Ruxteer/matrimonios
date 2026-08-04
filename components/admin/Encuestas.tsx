"use client";

import { useCallback, useEffect, useState } from "react";
import type { TipoPregunta } from "@/lib/db";

type PreguntaFila = {
  id: number;
  texto: string;
  tipo: TipoPregunta;
  /** JSON tal como está en la base; se lee con opcionesDe. */
  opciones: string;
  obligatoria: number;
  orden: number;
};

type EncuestaFila = {
  id: number;
  titulo: string;
  descripcion: string;
  mensaje_final: string;
  pide_nombre: number;
  abierta: number;
  orden: number;
  respuestas: number;
  preguntas: PreguntaFila[];
};

type Respuesta = {
  id: number;
  participante: string;
  created_at: string;
  valores: { pregunta_id: number; valor: string }[];
};

type PreguntaBorrador = {
  /** Sin id es una pregunta nueva que todavía no se guarda. */
  id?: number;
  texto: string;
  tipo: TipoPregunta;
  opciones: string[];
  obligatoria: number;
};

type Borrador = {
  id: number;
  titulo: string;
  descripcion: string;
  mensaje_final: string;
  pide_nombre: number;
  abierta: number;
  preguntas: PreguntaBorrador[];
};

const TIPOS: { valor: TipoPregunta; label: string }[] = [
  { valor: "corta", label: "Respuesta corta" },
  { valor: "parrafo", label: "Párrafo" },
  { valor: "unica", label: "Selección única" },
  { valor: "multiple", label: "Selección múltiple" },
  { valor: "escala", label: "Escala 1 a 5" },
  { valor: "si_no", label: "Sí / No" },
];

const CON_OPCIONES: TipoPregunta[] = ["unica", "multiple"];

function cuenta(total: number, singular: string, plural: string): string {
  return `${total} ${total === 1 ? singular : plural}`;
}

function opcionesDe(json: string): string[] {
  try {
    const leido = JSON.parse(json || "[]");
    return Array.isArray(leido) ? leido.map((o) => String(o)) : [];
  } catch {
    return [];
  }
}

function desdeEncuesta(e: EncuestaFila): Borrador {
  return {
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion,
    mensaje_final: e.mensaje_final,
    pide_nombre: e.pide_nombre,
    abierta: e.abierta,
    preguntas: e.preguntas.map((p) => ({
      id: p.id,
      texto: p.texto,
      tipo: p.tipo,
      opciones: opcionesDe(p.opciones),
      obligatoria: p.obligatoria,
    })),
  };
}

const INPUT = "w-full rounded-lg border border-neutral-300 px-3 py-2";
const BOTON_SUAVE = "rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50";

export default function Encuestas({ slug }: { slug: string }) {
  const [encuestas, setEncuestas] = useState<EncuestaFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [estado, setEstado] = useState("");
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [viendo, setViendo] = useState<number | null>(null);
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);

  const cargar = useCallback(() => {
    fetch(`/api/eventos/${slug}/encuestas`).then(async (res) => {
      if (res.ok) setEncuestas(await res.json());
      setCargando(false);
    });
  }, [slug]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear() {
    const nombre = titulo.trim();
    if (!nombre) return;
    const res = await fetch(`/api/eventos/${slug}/encuestas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: nombre }),
    });
    if (!res.ok) {
      setEstado("No pudimos crear la encuesta.");
      return;
    }
    const nueva: EncuestaFila = await res.json();
    setEncuestas((es) => [...es, nueva]);
    setBorrador(desdeEncuesta(nueva));
    setTitulo("");
    setEstado("Encuesta creada: agrégale preguntas.");
  }

  async function guardar(id: number, cambios: Record<string, unknown>, mensaje = "Guardado") {
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${slug}/encuestas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    if (!res.ok) {
      setEstado("No pudimos guardar los cambios.");
      return;
    }
    const actualizada: EncuestaFila = await res.json();
    setEncuestas((es) => es.map((e) => (e.id === id ? actualizada : e)));
    // El borrador se rearma con lo guardado: así las preguntas nuevas quedan
    // con su id y el próximo guardado las actualiza en vez de duplicarlas.
    setBorrador((b) => (b && b.id === id ? desdeEncuesta(actualizada) : b));
    setEstado(mensaje);
  }

  async function eliminar(e: EncuestaFila) {
    if (
      !confirm(
        `¿Eliminar la encuesta "${e.titulo}"? Se borran también sus ${e.respuestas} respuestas.`
      )
    )
      return;
    const res = await fetch(`/api/eventos/${slug}/encuestas/${e.id}`, { method: "DELETE" });
    if (!res.ok) {
      setEstado("No pudimos eliminar la encuesta.");
      return;
    }
    setEncuestas((es) => es.filter((x) => x.id !== e.id));
    if (borrador?.id === e.id) setBorrador(null);
    if (viendo === e.id) setViendo(null);
    setEstado("Encuesta eliminada.");
  }

  async function verResultados(id: number) {
    if (viendo === id) {
      setViendo(null);
      return;
    }
    setViendo(id);
    setRespuestas([]);
    const res = await fetch(`/api/eventos/${slug}/encuestas/${id}/respuestas`);
    if (res.ok) setRespuestas(await res.json());
  }

  function cambiarPregunta(indice: number, cambios: Partial<PreguntaBorrador>) {
    setBorrador((b) =>
      b
        ? {
            ...b,
            preguntas: b.preguntas.map((p, i) => (i === indice ? { ...p, ...cambios } : p)),
          }
        : b
    );
  }

  function moverPregunta(indice: number, salto: number) {
    setBorrador((b) => {
      if (!b) return b;
      const destino = indice + salto;
      if (destino < 0 || destino >= b.preguntas.length) return b;
      const preguntas = [...b.preguntas];
      [preguntas[indice], preguntas[destino]] = [preguntas[destino], preguntas[indice]];
      return { ...b, preguntas };
    });
  }

  if (cargando) return <p className="text-neutral-500">Cargando…</p>;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 font-medium">Encuestas</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Preguntas para conocer la opinión de los invitados. Cada uno responde una vez
          desde su teléfono y solo ve las encuestas abiertas.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") crear();
            }}
            placeholder="Título de la encuesta"
            className="w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-2"
          />
          <button
            onClick={crear}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
          >
            Crear encuesta
          </button>
        </div>
      </section>

      {encuestas.length === 0 && (
        <p className="text-neutral-400">Todavía no hay encuestas.</p>
      )}

      <div className="space-y-4">
        {encuestas.map((e) => (
          <section key={e.id} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-medium">{e.titulo}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  e.abierta === 1
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {e.abierta === 1 ? "Abierta" : "Cerrada"}
              </span>
              <span className="text-sm text-neutral-500">
                {cuenta(e.preguntas.length, "pregunta", "preguntas")} ·{" "}
                {cuenta(e.respuestas, "respuesta", "respuestas")}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button
                onClick={() => setBorrador(borrador?.id === e.id ? null : desdeEncuesta(e))}
                className={BOTON_SUAVE}
              >
                {borrador?.id === e.id ? "Cerrar editor" : "Editar"}
              </button>
              <button onClick={() => verResultados(e.id)} className={BOTON_SUAVE}>
                {viendo === e.id ? "Ocultar resultados" : "Ver resultados"}
              </button>
              <button
                onClick={() =>
                  guardar(
                    e.id,
                    { abierta: e.abierta === 1 ? 0 : 1 },
                    e.abierta === 1 ? "Encuesta cerrada." : "Encuesta abierta."
                  )
                }
                className={BOTON_SUAVE}
              >
                {e.abierta === 1 ? "Cerrar" : "Abrir"}
              </button>
              <button
                onClick={() => eliminar(e)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-500 hover:bg-neutral-50 hover:text-rose-600"
              >
                Eliminar
              </button>
            </div>

            {borrador?.id === e.id && (
              <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-neutral-500">Título</span>
                    <input
                      value={borrador.titulo}
                      onChange={(ev) =>
                        setBorrador({ ...borrador, titulo: ev.target.value })
                      }
                      className={INPUT}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-neutral-500">
                      Descripción (opcional)
                    </span>
                    <input
                      value={borrador.descripcion}
                      onChange={(ev) =>
                        setBorrador({ ...borrador, descripcion: ev.target.value })
                      }
                      className={INPUT}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block text-neutral-500">
                    Mensaje al terminar (si lo dejas vacío se muestra “¡Gracias!”)
                  </span>
                  <input
                    value={borrador.mensaje_final}
                    onChange={(ev) =>
                      setBorrador({ ...borrador, mensaje_final: ev.target.value })
                    }
                    placeholder="¡Gracias por responder!"
                    className={INPUT}
                  />
                </label>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={borrador.pide_nombre === 1}
                      onChange={(ev) =>
                        setBorrador({
                          ...borrador,
                          pide_nombre: ev.target.checked ? 1 : 0,
                        })
                      }
                    />
                    Pedir el nombre del invitado
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={borrador.abierta === 1}
                      onChange={(ev) =>
                        setBorrador({ ...borrador, abierta: ev.target.checked ? 1 : 0 })
                      }
                    />
                    Abierta (visible para los invitados)
                  </label>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Preguntas</p>
                  {borrador.preguntas.length === 0 && (
                    <p className="text-sm text-neutral-400">
                      Sin preguntas todavía: la encuesta no se le muestra a nadie.
                    </p>
                  )}
                  {borrador.preguntas.map((p, i) => (
                    <div
                      key={p.id ?? `nueva-${i}`}
                      className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={p.texto}
                          onChange={(ev) => cambiarPregunta(i, { texto: ev.target.value })}
                          placeholder="¿Qué quieres preguntar?"
                          className="min-w-[12rem] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        />
                        <select
                          value={p.tipo}
                          onChange={(ev) =>
                            cambiarPregunta(i, { tipo: ev.target.value as TipoPregunta })
                          }
                          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                        >
                          {TIPOS.map((t) => (
                            <option key={t.valor} value={t.valor}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => moverPregunta(i, -1)}
                          disabled={i === 0}
                          title="Subir"
                          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moverPregunta(i, 1)}
                          disabled={i === borrador.preguntas.length - 1}
                          title="Bajar"
                          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() =>
                            setBorrador({
                              ...borrador,
                              preguntas: borrador.preguntas.filter((_, j) => j !== i),
                            })
                          }
                          title="Eliminar pregunta"
                          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-500 hover:text-rose-600"
                        >
                          ✕
                        </button>
                      </div>

                      {CON_OPCIONES.includes(p.tipo) && (
                        <div className="mt-2 space-y-1.5 pl-1">
                          {p.opciones.map((o, j) => (
                            <div key={j} className="flex items-center gap-2">
                              <span className="text-neutral-400">·</span>
                              <input
                                value={o}
                                onChange={(ev) =>
                                  cambiarPregunta(i, {
                                    opciones: p.opciones.map((x, k) =>
                                      k === j ? ev.target.value : x
                                    ),
                                  })
                                }
                                placeholder={`Opción ${j + 1}`}
                                className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-1 text-sm"
                              />
                              <button
                                onClick={() =>
                                  cambiarPregunta(i, {
                                    opciones: p.opciones.filter((_, k) => k !== j),
                                  })
                                }
                                title="Quitar opción"
                                className="text-sm text-neutral-400 hover:text-rose-600"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() =>
                              cambiarPregunta(i, { opciones: [...p.opciones, ""] })
                            }
                            className="text-sm text-neutral-500 underline hover:text-neutral-800"
                          >
                            Agregar opción
                          </button>
                        </div>
                      )}

                      <label className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
                        <input
                          type="checkbox"
                          checked={p.obligatoria === 1}
                          onChange={(ev) =>
                            cambiarPregunta(i, { obligatoria: ev.target.checked ? 1 : 0 })
                          }
                        />
                        Obligatoria
                      </label>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setBorrador({
                        ...borrador,
                        preguntas: [
                          ...borrador.preguntas,
                          { texto: "", tipo: "corta", opciones: [], obligatoria: 0 },
                        ],
                      })
                    }
                    className={`${BOTON_SUAVE} text-sm`}
                  >
                    Agregar pregunta
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() =>
                      guardar(e.id, {
                        titulo: borrador.titulo,
                        descripcion: borrador.descripcion,
                        mensaje_final: borrador.mensaje_final,
                        pide_nombre: borrador.pide_nombre,
                        abierta: borrador.abierta,
                        preguntas: borrador.preguntas,
                      })
                    }
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
                  >
                    Guardar encuesta
                  </button>
                  <p className="text-sm text-neutral-400">
                    Las preguntas sin texto no se guardan. Borrar una pregunta borra
                    también lo que hayan contestado en ella.
                  </p>
                </div>
              </div>
            )}

            {viendo === e.id && (
              <Resultados encuesta={e} respuestas={respuestas} />
            )}
          </section>
        ))}
      </div>

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}
    </div>
  );
}

function etiquetaDe(tipo: TipoPregunta, clave: string): string {
  if (tipo !== "si_no") return clave;
  return clave === "si" ? "Sí" : "No";
}

// Para las preguntas de alternativas se cuenta cada opción; el porcentaje se
// mide contra los invitados que contestaron esa pregunta, no contra el total.
function conteoDe(pregunta: PreguntaFila, valores: string[]) {
  const claves =
    pregunta.tipo === "escala"
      ? ["1", "2", "3", "4", "5"]
      : pregunta.tipo === "si_no"
        ? ["si", "no"]
        : opcionesDe(pregunta.opciones);

  const cuenta = new Map<string, number>(claves.map((c) => [c, 0]));
  for (const valor of valores) {
    const partes = pregunta.tipo === "multiple" ? opcionesDe(valor) : [valor];
    for (const parte of partes) cuenta.set(parte, (cuenta.get(parte) ?? 0) + 1);
  }
  return [...cuenta].map(([clave, total]) => ({
    etiqueta: etiquetaDe(pregunta.tipo, clave),
    total,
  }));
}

function Resultados({
  encuesta,
  respuestas,
}: {
  encuesta: EncuestaFila;
  respuestas: Respuesta[];
}) {
  return (
    <div className="mt-4 space-y-5 border-t border-neutral-200 pt-4">
      <p className="text-sm font-medium">
        {cuenta(respuestas.length, "respuesta", "respuestas")} en total
        {encuesta.respuestas > 0 && respuestas.length === 0 && " · cargando…"}
      </p>

      {encuesta.preguntas.map((p) => {
        const valores = respuestas.flatMap((r) =>
          r.valores.filter((v) => v.pregunta_id === p.id).map((v) => v.valor)
        );
        const abierta = p.tipo === "corta" || p.tipo === "parrafo";

        return (
          <div key={p.id}>
            <p className="text-sm font-medium">{p.texto}</p>
            <p className="mb-2 text-xs text-neutral-400">
              {valores.length === 1 ? "1 invitado respondió" : `${valores.length} invitados respondieron`}
            </p>

            {abierta ? (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {valores.length === 0 && (
                  <p className="text-sm text-neutral-400">Sin respuestas.</p>
                )}
                {valores.map((valor, i) => (
                  <p
                    key={i}
                    className="whitespace-pre-wrap rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
                  >
                    {valor}
                  </p>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {conteoDe(p, valores).map(({ etiqueta, total }) => {
                  const porcentaje = valores.length
                    ? Math.round((total / valores.length) * 100)
                    : 0;
                  return (
                    <div key={etiqueta}>
                      <div className="flex justify-between text-sm">
                        <span>{etiqueta}</span>
                        <span className="text-neutral-500">
                          {total} · {porcentaje}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-neutral-100">
                        <div
                          className="h-2 rounded-full bg-neutral-900"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
