"use client";

import { useCallback, useEffect, useState } from "react";
import { urlArchivo } from "@/lib/urls";
import type { OpcionVotacion, Votacion } from "@/lib/db";

type OpcionAdmin = OpcionVotacion & { votos: number };
type VotacionAdmin = Votacion & { opciones: OpcionAdmin[]; total: number };

// Las alternativas que todavía no existen en la base llevan id negativo: sirve
// de clave en React y el servidor las reconoce como nuevas.
let secuencia = 0;
function opcionEnBlanco(votacionId: number): OpcionAdmin {
  return { id: --secuencia, votacion_id: votacionId, texto: "", imagen: "", orden: 0, votos: 0 };
}

export default function Votaciones({ slug }: { slug: string }) {
  const [votaciones, setVotaciones] = useState<VotacionAdmin[]>([]);
  const [nueva, setNueva] = useState("");
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(0);
  const [estado, setEstado] = useState("");

  const cargar = useCallback(() => {
    fetch(`/api/eventos/${slug}/votaciones`)
      .then((r) => (r.ok ? r.json() : []))
      .then((datos: VotacionAdmin[]) => setVotaciones(datos))
      .finally(() => setCargando(false));
  }, [slug]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Los votos entran mientras el organizador mira la pantalla, así que se
  // refrescan solos; se copian solo los conteos para no pisar lo que esté
  // escribiendo en ese momento.
  useEffect(() => {
    const tarea = setInterval(async () => {
      const res = await fetch(`/api/eventos/${slug}/votaciones`);
      if (!res.ok) return;
      const frescas: VotacionAdmin[] = await res.json();
      setVotaciones((vs) =>
        vs.map((v) => {
          const fresca = frescas.find((f) => f.id === v.id);
          if (!fresca) return v;
          return {
            ...v,
            total: fresca.total,
            opciones: v.opciones.map((o) => ({
              ...o,
              votos: fresca.opciones.find((f) => f.id === o.id)?.votos ?? 0,
            })),
          };
        })
      );
    }, 10000);
    return () => clearInterval(tarea);
  }, [slug]);

  function editar(id: number, cambios: Partial<VotacionAdmin>) {
    setVotaciones((vs) => vs.map((v) => (v.id === id ? { ...v, ...cambios } : v)));
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const titulo = nueva.trim();
    if (!titulo) return;
    const res = await fetch(`/api/eventos/${slug}/votaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    });
    if (!res.ok) {
      setEstado("No pudimos crear la votación.");
      return;
    }
    const creada: VotacionAdmin = await res.json();
    setVotaciones((vs) => [
      ...vs,
      { ...creada, opciones: [opcionEnBlanco(creada.id), opcionEnBlanco(creada.id)] },
    ]);
    setNueva("");
    setEstado("Votación creada: escribe las alternativas y guarda.");
  }

  async function guardar(v: VotacionAdmin, mensaje = "Guardado") {
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${slug}/votaciones/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: v.titulo,
        descripcion: v.descripcion,
        multiple: v.multiple,
        resultados: v.resultados,
        abierta: v.abierta,
        opciones: v.opciones.map((o) => ({ id: o.id, texto: o.texto, imagen: o.imagen })),
      }),
    });
    const datos = await res.json().catch(() => null);
    if (!res.ok) {
      setEstado(datos?.error ?? "No pudimos guardar la votación.");
      return;
    }
    setVotaciones((vs) => vs.map((x) => (x.id === v.id ? datos : x)));
    setEstado(mensaje);
  }

  async function eliminar(v: VotacionAdmin) {
    if (
      !confirm(
        `¿Eliminar la votación “${v.titulo}”? Se borran sus alternativas y sus votos. ` +
          "Esto no se puede deshacer."
      )
    )
      return;
    const res = await fetch(`/api/eventos/${slug}/votaciones/${v.id}`, { method: "DELETE" });
    if (!res.ok) {
      setEstado("No pudimos eliminar la votación.");
      return;
    }
    setVotaciones((vs) => vs.filter((x) => x.id !== v.id));
    setEstado("Votación eliminada.");
  }

  async function reiniciar(v: VotacionAdmin) {
    if (!confirm(`¿Borrar los ${v.total} votos de “${v.titulo}”? Esto no se puede deshacer.`))
      return;
    const res = await fetch(`/api/eventos/${slug}/votaciones/${v.id}/votar`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setEstado("No pudimos reiniciar los votos.");
      return;
    }
    editar(v.id, { total: 0, opciones: v.opciones.map((o) => ({ ...o, votos: 0 })) });
    setEstado("Votos reiniciados: los invitados pueden votar de nuevo.");
  }

  async function subirImagen(v: VotacionAdmin, opcion: OpcionAdmin, file: File) {
    setSubiendo(opcion.id);
    const datos = new FormData();
    datos.append("file", file);
    const res = await fetch("/api/archivos", { method: "POST", body: datos });
    const data = await res.json().catch(() => null);
    setSubiendo(0);
    if (!res.ok) {
      setEstado(data?.error ?? "No pudimos subir la imagen.");
      return;
    }
    // Se guarda de inmediato: una imagen subida y no guardada queda sin dueño.
    await guardar(
      {
        ...v,
        opciones: v.opciones.map((o) =>
          o.id === opcion.id ? { ...o, imagen: data.archivo } : o
        ),
      },
      "Imagen agregada"
    );
  }

  function mover(v: VotacionAdmin, indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= v.opciones.length) return;
    const opciones = [...v.opciones];
    [opciones[indice], opciones[destino]] = [opciones[destino], opciones[indice]];
    editar(v.id, { opciones });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 font-medium">Votaciones</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Los invitados eligen entre las alternativas que escribas aquí. Cada teléfono vota
          una vez por votación, y solo se le muestran las votaciones abiertas.
        </p>
        <form onSubmit={crear} className="flex flex-wrap items-center gap-2">
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="¿Qué canción abre la fiesta?"
            className="w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
          >
            Crear votación
          </button>
        </form>
      </section>

      {cargando && <p className="text-neutral-400">Cargando…</p>}
      {!cargando && votaciones.length === 0 && (
        <p className="text-neutral-400">Todavía no hay votaciones.</p>
      )}

      {votaciones.map((v) => (
        <section key={v.id} className="rounded-xl border border-neutral-200 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={v.titulo}
              onChange={(e) => editar(v.id, { titulo: e.target.value })}
              className="min-w-60 flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-medium"
            />
            <button
              onClick={() =>
                guardar(
                  { ...v, abierta: v.abierta ? 0 : 1 },
                  v.abierta ? "Votación cerrada." : "Votación abierta."
                )
              }
              title={v.abierta ? "Cerrar la votación" : "Abrir la votación"}
              className={`rounded-lg border px-3 py-2 text-sm ${
                v.abierta
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-500 hover:bg-neutral-50"
              }`}
            >
              {v.abierta ? "Abierta" : "Cerrada"}
            </button>
          </div>

          <input
            value={v.descripcion}
            onChange={(e) => editar(v.id, { descripcion: e.target.value })}
            placeholder="Descripción o instrucción (opcional)"
            className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />

          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={v.multiple === 1}
                onChange={(e) => guardar({ ...v, multiple: e.target.checked ? 1 : 0 }, "Listo")}
              />
              Permitir elegir varias alternativas
            </label>
            <label className="flex items-center gap-2">
              <span className="text-neutral-500">Resultados:</span>
              <select
                value={v.resultados}
                onChange={(e) =>
                  guardar(
                    { ...v, resultados: e.target.value as Votacion["resultados"] },
                    "Listo"
                  )
                }
                className="rounded-lg border border-neutral-300 px-3 py-2"
              >
                <option value="siempre">En vivo: cada invitado los ve al votar</option>
                <option value="al_cerrar">Al cerrar: mientras vota nadie los ve</option>
                <option value="nunca">Nunca: solo se ven aquí</option>
              </select>
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium">Alternativas</h3>
              <div className="space-y-2">
                {v.opciones.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button
                        onClick={() => mover(v, i, -1)}
                        title="Subir"
                        aria-label={`Subir ${o.texto || "alternativa"}`}
                        className="px-1 text-xs text-neutral-400 hover:text-neutral-800"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => mover(v, i, 1)}
                        title="Bajar"
                        aria-label={`Bajar ${o.texto || "alternativa"}`}
                        className="px-1 text-xs text-neutral-400 hover:text-neutral-800"
                      >
                        ↓
                      </button>
                    </div>

                    {o.imagen ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={urlArchivo(o.imagen)}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg border border-neutral-200 object-cover"
                      />
                    ) : null}

                    <input
                      value={o.texto}
                      onChange={(e) =>
                        editar(v.id, {
                          opciones: v.opciones.map((x) =>
                            x.id === o.id ? { ...x, texto: e.target.value } : x
                          ),
                        })
                      }
                      placeholder="Nombre de la alternativa"
                      className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />

                    <label
                      title={o.imagen ? "Cambiar la imagen" : "Agregar una imagen"}
                      className="cursor-pointer rounded-lg border border-neutral-300 px-2 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
                    >
                      {subiendo === o.id ? "…" : o.imagen ? "Cambiar" : "Imagen"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) subirImagen(v, o, f);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    <button
                      onClick={() =>
                        editar(v.id, { opciones: v.opciones.filter((x) => x.id !== o.id) })
                      }
                      title="Eliminar alternativa"
                      aria-label={`Eliminar ${o.texto || "alternativa"}`}
                      className="px-1 text-neutral-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    editar(v.id, { opciones: [...v.opciones, opcionEnBlanco(v.id)] })
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                >
                  Agregar alternativa
                </button>
                <button
                  onClick={() => guardar(v)}
                  className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm text-white hover:bg-neutral-700"
                >
                  Guardar votación
                </button>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Al guardar, las alternativas sin nombre no se crean y las que borres se van
                con los votos que tenían.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-medium">Resultados</h3>
                <span className="text-xs text-neutral-400">
                  {v.total} {v.total === 1 ? "voto" : "votos"}
                </span>
              </div>
              {v.total === 0 && (
                <p className="mb-2 text-sm text-neutral-400">Todavía nadie vota.</p>
              )}
              <div className="space-y-2">
                {v.opciones
                  .filter((o) => o.texto.trim())
                  .map((o) => {
                    const porcentaje = v.total ? Math.round((o.votos * 100) / v.total) : 0;
                    return (
                      <div key={o.id}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate">{o.texto}</span>
                          <span className="shrink-0 text-neutral-500">
                            {o.votos} · {porcentaje}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full rounded-full bg-neutral-800"
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => reiniciar(v)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50"
                >
                  Reiniciar votos
                </button>
                <button
                  onClick={() => eliminar(v)}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
                >
                  Eliminar votación
                </button>
              </div>
            </div>
          </div>
        </section>
      ))}

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}
    </div>
  );
}
