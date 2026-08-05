"use client";

import { useState } from "react";
import type { EventoPanel } from "@/lib/eventos";
import { definicion, modulosDeEvento, type ModuloId } from "@/lib/modulos";

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
        <h2 className="mb-1 font-medium">Qué ve el invitado</h2>
        <p className="text-sm text-neutral-500">
          Enciende los módulos que quieras y ordénalos: así aparecen en el inicio del
          sitio y en los atajos. {encendidos} de {filas.length} encendidos.
        </p>
      </div>

      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200">
        {filas.map((fila, i) => {
          const m = definicion(fila.id);
          const sinPlano = m.requiere === "mapa" && !evento.mapa;
          return (
            <li
              key={fila.id}
              className={`flex items-center gap-4 p-4 ${fila.activo ? "" : "bg-neutral-50"}`}
            >
              <span className="w-6 text-center text-sm tabular-nums text-neutral-400">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`font-medium ${fila.activo ? "" : "text-neutral-400"}`}>
                  {m.nombre}
                  {fila.activo && sinPlano && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
                      falta subir el plano en Ajustes
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
            </li>
          );
        })}
      </ul>

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}
    </div>
  );
}
