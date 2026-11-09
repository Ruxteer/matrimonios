"use client";

/* eslint-disable @next/next/no-img-element -- imágenes subidas por el organizador */
import { useEffect, useRef, useState } from "react";
import { PuntoZona } from "@/components/MapaZonas";
import { IconoZona } from "@/components/IconosMapa";
import type { EventoPanel } from "@/lib/eventos";
import {
  ICONOS_MAPA,
  LIMITES_MAPA,
  leerMapa,
  SUBTITULO_MAPA,
  type ConfigMapa,
  type DetalleZona,
  type IconoMapa,
  type ZonaMapa,
} from "@/lib/mapa";
import { urlArchivo } from "@/lib/urls";
import { textoSobre } from "@/lib/colores";

const NOMBRE_ICONO = new Map<string, string>(ICONOS_MAPA);

async function subirImagen(file: File): Promise<string> {
  const datos = new FormData();
  datos.append("file", file);
  const res = await fetch("/api/archivos", { method: "POST", body: datos });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pudimos subir la imagen.");
  return data.archivo;
}

const redondear = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;

/**
 * Editor del módulo Mapa (Figma "creative-wiin"): el plano, las zonas que el
 * invitado toca sobre él (cada una con su ficha) y la leyenda de abajo.
 * El plano se guarda apenas se sube; las zonas, con "Guardar mapa".
 */
export default function Mapa({
  evento,
  onGuardado,
}: {
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
}) {
  const [config, setConfig] = useState<ConfigMapa>(() => leerMapa(evento.mapa_config));
  const [elegida, setElegida] = useState<number | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [estado, setEstado] = useState("");
  const [subiendo, setSubiendo] = useState("");
  const plano = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ i: number; movido: boolean } | null>(null);

  // Salir de la pestaña con cambios sin guardar los pierde: el navegador avisa.
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  function cambiar(f: (c: ConfigMapa) => ConfigMapa) {
    setConfig(f);
    setSucio(true);
  }

  function cambiarZona(i: number, cambios: Partial<ZonaMapa>) {
    cambiar((c) => ({ ...c, zonas: c.zonas.map((z, j) => (j === i ? { ...z, ...cambios } : z)) }));
  }

  async function patch(cambios: Record<string, unknown>): Promise<EventoPanel | null> {
    const res = await fetch(`/api/eventos/${evento.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    if (!res.ok) return null;
    const actualizado: EventoPanel = await res.json();
    onGuardado(actualizado);
    return actualizado;
  }

  async function guardar() {
    setEstado("Guardando…");
    const actualizado = await patch({ mapa_config: config });
    if (!actualizado) {
      setEstado("No pudimos guardar el mapa.");
      return;
    }
    setConfig(leerMapa(actualizado.mapa_config));
    setSucio(false);
    setEstado("Mapa guardado.");
  }

  async function subirPlano(file: File) {
    setSubiendo("plano");
    try {
      const archivo = await subirImagen(file);
      const actualizado = await patch({ mapa: archivo });
      setEstado(actualizado ? "Plano actualizado." : "No pudimos guardar el plano.");
    } catch (err) {
      setEstado(err instanceof Error ? err.message : "No pudimos subir el plano.");
    } finally {
      setSubiendo("");
    }
  }

  async function quitarPlano() {
    if (!confirm("¿Quitar el plano? Los participantes dejan de ver la sección Mapa. Las zonas quedan guardadas.")) return;
    const actualizado = await patch({ mapa: "" });
    setEstado(actualizado ? "Plano quitado." : "No pudimos quitar el plano.");
  }

  async function subirFotoZona(i: number, file: File) {
    setSubiendo(`zona-${i}`);
    try {
      cambiarZona(i, { imagen: await subirImagen(file) });
      setEstado("Foto lista. Guarda el mapa para publicarla.");
    } catch (err) {
      setEstado(err instanceof Error ? err.message : "No pudimos subir la foto.");
    } finally {
      setSubiendo("");
    }
  }

  // Dónde cae un puntero sobre el plano, en porcentaje.
  function posicion(e: { clientX: number; clientY: number }) {
    const r = plano.current!.getBoundingClientRect();
    return {
      x: redondear(((e.clientX - r.left) / r.width) * 100),
      y: redondear(((e.clientY - r.top) / r.height) * 100),
    };
  }

  function tocarPlano(e: React.MouseEvent) {
    if (!agregando) return;
    if (config.zonas.length >= LIMITES_MAPA.zonas) return;
    const { x, y } = posicion(e);
    const nueva: ZonaMapa = {
      id: "",
      nombre: `Zona ${config.zonas.length + 1}`,
      x,
      y,
      icono: "punto",
      descripcion: "",
      imagen: "",
      detalles: [],
    };
    cambiar((c) => ({ ...c, zonas: [...c.zonas, nueva] }));
    setElegida(config.zonas.length);
    setAgregando(false);
  }

  function eliminarZona(i: number) {
    if (!confirm(`¿Eliminar la zona "${config.zonas[i].nombre}"?`)) return;
    cambiar((c) => ({ ...c, zonas: c.zonas.filter((_, j) => j !== i) }));
    setElegida(null);
  }

  const zona = elegida !== null ? config.zonas[elegida] : null;
  // El plano del panel se ve con el color de botones del evento, como lo verá el invitado.
  const colores = {
    "--rosa": evento.color_rosa,
    "--rosa-texto": textoSobre(evento.color_rosa),
  } as React.CSSProperties;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 font-medium">Plano del lugar</h2>
        <p className="mb-4 max-w-2xl text-sm text-neutral-500">
          Sube una imagen del lugar y marca encima las zonas que el participante puede tocar:
          cada una abre su ficha con foto, descripción y lo que ofrece. Sin plano, la
          sección Mapa no se le muestra a los participantes.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
            {subiendo === "plano" ? "Subiendo…" : evento.mapa ? "Cambiar plano" : "Subir plano"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subirPlano(f);
                e.target.value = "";
              }}
            />
          </label>
          {evento.mapa && (
            <>
              <button onClick={quitarPlano} className="text-sm text-neutral-500 underline hover:text-neutral-800">
                Quitar plano
              </button>
              <a
                href={`/${evento.slug}/mapa`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-sm text-neutral-500 underline hover:text-neutral-800"
              >
                Ver como participante ↗
              </a>
            </>
          )}
        </div>
      </section>

      {evento.mapa && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">
              Zonas <span className="text-sm font-normal text-neutral-400">({config.zonas.length})</span>
            </h2>
            <button
              onClick={() => setAgregando((v) => !v)}
              disabled={config.zonas.length >= LIMITES_MAPA.zonas}
              className={`rounded-lg px-4 py-2 text-sm disabled:opacity-30 ${
                agregando
                  ? "border border-neutral-900 bg-white text-neutral-900"
                  : "bg-neutral-900 text-white hover:bg-neutral-700"
              }`}
            >
              {agregando ? "Cancelar" : "+ Agregar zona"}
            </button>
          </div>
          <p className="mb-3 text-sm text-neutral-500" role="status">
            {agregando
              ? "Toca el plano donde va la zona."
              : "Toca un punto para editar su zona. Arrástralo para moverlo."}
          </p>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-4">
              <div
                ref={plano}
                onClick={tocarPlano}
                style={colores}
                className={`@container relative select-none overflow-hidden rounded-xl border border-neutral-200 ${
                  agregando ? "cursor-crosshair ring-2 ring-neutral-900 ring-offset-2" : ""
                }`}
              >
                <img
                  src={urlArchivo(evento.mapa)}
                  alt="Plano del lugar"
                  draggable={false}
                  className="block w-full"
                />
                {config.zonas.map((z, i) => (
                  <button
                    key={i}
                    type="button"
                    title={z.nombre}
                    aria-label={`Zona ${z.nombre}`}
                    aria-pressed={elegida === i}
                    className="absolute -translate-x-1/2 -translate-y-1/2 touch-none rounded-full"
                    style={{ left: `${z.x}%`, top: `${z.y}%` }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      if (agregando) return;
                      arrastre.current = { i, movido: false };
                      try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                      } catch {
                        // Sin captura el arrastre igual funciona mientras el puntero siga encima.
                      }
                    }}
                    onPointerMove={(e) => {
                      if (arrastre.current?.i !== i) return;
                      arrastre.current.movido = true;
                      cambiarZona(i, posicion(e));
                    }}
                    onPointerUp={() => {
                      // Tocar o terminar de arrastrar deja la zona abierta en su ficha.
                      if (arrastre.current?.i === i) setElegida(i);
                      arrastre.current = null;
                    }}
                    onKeyDown={(e) => {
                      // Con el teclado: Enter elige, las flechas mueven de a medio punto.
                      const paso = e.shiftKey ? 2 : 0.5;
                      const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setElegida(i);
                      } else if (d) {
                        e.preventDefault();
                        cambiarZona(i, { x: redondear(z.x + d[0]), y: redondear(z.y + d[1]) });
                      }
                    }}
                  >
                    <PuntoZona icono={z.icono} elegido={elegida === i} />
                  </button>
                ))}
              </div>
              {config.zonas.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {config.zonas.map((z, i) => (
                    <li key={i}>
                      <button
                        onClick={() => setElegida(i)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                          elegida === i
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-300 hover:bg-neutral-50"
                        }`}
                      >
                        <IconoZona icono={z.icono} className="size-4" />
                        {z.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {zona && elegida !== null ? (
              <FichaZona
                key={elegida}
                zona={zona}
                slug={evento.slug}
                publicada={!sucio && Boolean(zona.id)}
                subiendo={subiendo === `zona-${elegida}`}
                onCambio={(c) => cambiarZona(elegida, c)}
                onFoto={(f) => subirFotoZona(elegida, f)}
                onEliminar={() => eliminarZona(elegida)}
                onCerrar={() => setElegida(null)}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
                {config.zonas.length
                  ? "Elige una zona en el plano para editar su ficha."
                  : "Todavía no hay zonas. Sin zonas, el participante ve el plano como una imagen."}
              </p>
            )}
          </div>
        </section>
      )}

      {evento.mapa && (
        <section>
          <h2 className="mb-1 font-medium">Texto bajo el título</h2>
          <p className="mb-2 text-sm text-neutral-500">
            Aparece bajo &ldquo;Explora el lugar&rdquo;. Vacío, se usa el de siempre cuando hay zonas.
          </p>
          <input
            value={config.subtitulo}
            onChange={(e) => cambiar((c) => ({ ...c, subtitulo: e.target.value }))}
            placeholder={SUBTITULO_MAPA}
            maxLength={LIMITES_MAPA.subtitulo}
            className="w-full max-w-2xl rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </section>
      )}

      {evento.mapa && (
        <section>
          <h2 className="mb-1 font-medium">Leyenda</h2>
          <p className="mb-3 text-sm text-neutral-500">
            Íconos con su significado, debajo del plano. Por ejemplo: Fotos, Foodtrucks, Baños.
          </p>
          <Etiquetas
            items={config.leyenda}
            maximo={LIMITES_MAPA.leyenda}
            agregar="+ Agregar a la leyenda"
            ejemplo="Zona baños"
            onCambio={(leyenda) => cambiar((c) => ({ ...c, leyenda }))}
          />
        </section>
      )}

      {(sucio || estado) && (
        <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-300 bg-white p-3 text-sm shadow-sm">
          <p role="status" className="text-neutral-700">
            {sucio && !estado.startsWith("Guardando") ? "Hay cambios sin guardar." : estado}
          </p>
          {sucio && (
            <button
              onClick={guardar}
              className="ml-auto rounded-lg bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
            >
              Guardar mapa
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FichaZona({
  zona,
  slug,
  publicada,
  subiendo,
  onCambio,
  onFoto,
  onEliminar,
  onCerrar,
}: {
  zona: ZonaMapa;
  slug: string;
  publicada: boolean;
  subiendo: boolean;
  onCambio: (c: Partial<ZonaMapa>) => void;
  onFoto: (f: File) => void;
  onEliminar: () => void;
  onCerrar: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">Ficha de la zona</p>
        <button onClick={onCerrar} className="text-sm text-neutral-400 hover:text-neutral-700">
          Cerrar
        </button>
      </div>

      <div className="flex items-end gap-2">
        <label className="block flex-1 text-sm">
          <span className="mb-1 block text-neutral-500">Nombre</span>
          <input
            value={zona.nombre}
            onChange={(e) => onCambio({ nombre: e.target.value })}
            maxLength={LIMITES_MAPA.nombre}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <SelectorIcono valor={zona.icono} onCambio={(icono) => onCambio({ icono })} />
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-500">Descripción</span>
        <textarea
          value={zona.descripcion}
          onChange={(e) => onCambio({ descripcion: e.target.value })}
          maxLength={LIMITES_MAPA.descripcion}
          rows={3}
          placeholder="El corazón del festival. Disfruta de las presentaciones en vivo…"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>

      <div className="text-sm">
        <span className="mb-1 block text-neutral-500">Foto de la zona</span>
        <div className="flex flex-wrap items-center gap-3">
          {zona.imagen && (
            <img
              src={urlArchivo(zona.imagen)}
              alt=""
              className="aspect-[4/3] w-32 rounded-lg border border-neutral-200 object-cover"
            />
          )}
          <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 hover:bg-neutral-50">
            {subiendo ? "Subiendo…" : zona.imagen ? "Cambiar" : "Subir foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFoto(f);
                e.target.value = "";
              }}
            />
          </label>
          {zona.imagen && (
            <button onClick={() => onCambio({ imagen: "" })} className="text-neutral-500 underline hover:text-neutral-800">
              Quitar
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-400">Horizontal, por ejemplo 1200 × 900. Sin foto se muestra el ícono.</p>
      </div>

      <div className="text-sm">
        <span className="mb-1 block text-neutral-500">Lo que ofrece</span>
        <Etiquetas
          items={zona.detalles}
          maximo={LIMITES_MAPA.detalles}
          agregar="+ Agregar"
          ejemplo="Música en vivo"
          onCambio={(detalles) => onCambio({ detalles })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4 text-sm">
        <button onClick={onEliminar} className="text-rose-600 underline hover:text-rose-800">
          Eliminar zona
        </button>
        {publicada && (
          <a
            href={`/${slug}/mapa/${zona.id}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-neutral-500 underline hover:text-neutral-800"
          >
            Ver la ficha ↗
          </a>
        )}
      </div>
    </div>
  );
}

/** Lista editable de ícono + texto (los detalles de una zona y la leyenda). */
function Etiquetas({
  items,
  maximo,
  agregar,
  ejemplo,
  onCambio,
}: {
  items: DetalleZona[];
  maximo: number;
  agregar: string;
  ejemplo: string;
  onCambio: (items: DetalleZona[]) => void;
}) {
  const cambiarItem = (i: number, c: Partial<DetalleZona>) =>
    onCambio(items.map((it, j) => (j === i ? { ...it, ...c } : it)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <SelectorIcono valor={it.icono} onCambio={(icono) => cambiarItem(i, { icono })} />
          <input
            value={it.texto}
            onChange={(e) => cambiarItem(i, { texto: e.target.value })}
            placeholder={ejemplo}
            maxLength={LIMITES_MAPA.texto}
            aria-label="Texto"
            className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => onCambio(items.filter((_, j) => j !== i))}
            aria-label={`Quitar ${it.texto || "fila"}`}
            className="rounded-lg px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ✕
          </button>
        </div>
      ))}
      {items.length < maximo && (
        <button
          onClick={() => onCambio([...items, { icono: "punto", texto: "" }])}
          className="rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          {agregar}
        </button>
      )}
      {items.some((it) => !it.texto.trim()) && (
        <p className="text-xs text-neutral-400">Las filas sin texto no se guardan.</p>
      )}
    </div>
  );
}

function SelectorIcono({ valor, onCambio }: { valor: IconoMapa; onCambio: (i: IconoMapa) => void }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !caja.current?.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("pointerdown", cerrar);
    document.addEventListener("keydown", cerrar);
    return () => {
      document.removeEventListener("pointerdown", cerrar);
      document.removeEventListener("keydown", cerrar);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={`Ícono: ${NOMBRE_ICONO.get(valor) ?? valor}. Cambiar`}
        className="flex h-10 items-center gap-1 rounded-lg border border-neutral-300 px-2.5 hover:bg-neutral-50"
      >
        <IconoZona icono={valor} className="size-5" />
        <span aria-hidden="true" className="text-xs text-neutral-400">▾</span>
      </button>
      {abierto && (
        <div className="absolute right-0 z-20 mt-1 grid w-[19.5rem] grid-cols-7 gap-1 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
          {ICONOS_MAPA.map(([id, nombre]) => (
            <button
              key={id}
              type="button"
              title={nombre}
              aria-label={nombre}
              aria-pressed={id === valor}
              onClick={() => {
                onCambio(id);
                setAbierto(false);
              }}
              className={`grid size-9 place-items-center rounded-lg ${
                id === valor ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
              }`}
            >
              <IconoZona icono={id} className="size-5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
