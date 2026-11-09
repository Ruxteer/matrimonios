"use client";

import { useState } from "react";
import type { EventoPanel } from "@/lib/eventos";
import { definicion, modulosDeEvento, type ModuloId } from "@/lib/modulos";
import { leerTextos } from "@/lib/textos";
import TextosModulo, { TextosDelInicio } from "./TextosModulo";

type Fila = { id: ModuloId; activo: boolean };

export default function Modulos({
  evento,
  onGuardado,
}: {
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
}) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    modulosDeEvento(evento).map(({ modulo, activo }) => ({ id: modulo.id, activo }))
  );
  const [estado, setEstado] = useState("");
  const [editando, setEditando] = useState<ModuloId | null>(null);
  const propios = leerTextos(evento.textos).modulos;

  // Cada cambio se guarda solo: el organizador está mirando el sitio en otra
  // pestaña y quiere ver el efecto de inmediato.
  async function guardar(nuevas: Fila[]) {
    setFilas(nuevas);
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${evento.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulos: nuevas }),
    });
    if (!res.ok) {
      setEstado("No pudimos guardar los cambios.");
      return;
    }
    onGuardado(await res.json());
    setEstado("Guardado");
  }

  function alternar(id: ModuloId) {
    guardar(filas.map((f) => (f.id === id ? { ...f, activo: !f.activo } : f)));
  }

  function mover(desde: number, hacia: number) {
    if (hacia < 0 || hacia >= filas.length) return;
    const nuevas = [...filas];
    [nuevas[desde], nuevas[hacia]] = [nuevas[hacia], nuevas[desde]];
    guardar(nuevas);
  }

  const encendidos = filas.filter((f) => f.activo).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 font-medium">Qué ve el participante</h2>
        <p className="text-sm text-neutral-500">
          Enciende los módulos que quieras y ordénalos: así aparecen en el inicio del
          sitio y en los atajos. Con «Textos» cambias el título, la tarjeta y el botón de
          cada uno, con vista previa antes de publicar. {encendidos} de {filas.length} encendidos.
        </p>
      </div>

      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200">
        {filas.map((fila, i) => {
          const m = definicion(fila.id);
          const sinPlano = m.requiere === "mapa" && !evento.mapa;
          return (
            <li key={fila.id}>
            <div className={`flex items-center gap-4 p-4 ${fila.activo ? "" : "bg-neutral-50"}`}>
              <span className="w-6 text-center text-sm tabular-nums text-neutral-400">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`font-medium ${fila.activo ? "" : "text-neutral-400"}`}>
                  {m.nombre}
                  {fila.activo && sinPlano && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
                      falta subir el plano en la pestaña Mapa
                    </span>
                  )}
                </p>
                <p className="text-sm text-neutral-500">{m.descripcion}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => mover(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Subir ${m.nombre}`}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => mover(i, i + 1)}
                  disabled={i === filas.length - 1}
                  aria-label={`Bajar ${m.nombre}`}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>

              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={fila.activo}
                  onChange={() => alternar(fila.id)}
                  className="h-4 w-4"
                />
                {fila.activo ? "Visible" : "Oculto"}
              </label>

              <button
                onClick={() => setEditando(editando === fila.id ? null : fila.id)}
                aria-expanded={editando === fila.id}
                title={propios[fila.id] ? "Este módulo tiene textos propios" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1 text-sm ${
                  editando === fila.id
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Textos
                {/* Mismo ancho editado o no, para que las filas no se descuadren. */}
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${propios[fila.id] ? "bg-amber-500" : "bg-transparent"}`}
                />
                {propios[fila.id] && <span className="sr-only">(editados)</span>}
              </button>
            </div>
            {editando === fila.id && (
              <TextosModulo key={fila.id} evento={evento} id={fila.id} onGuardado={onGuardado} />
            )}
            </li>
          );
        })}
      </ul>

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}

      <TextosDelInicio evento={evento} onGuardado={onGuardado} />
    </div>
  );
}
