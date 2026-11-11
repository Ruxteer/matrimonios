"use client";

import { useState } from "react";
import type { EventoPanel } from "@/lib/eventos";
import type { EstadoModeracion } from "@/lib/moderacion";
import { registroConfig } from "@/lib/registro";

// Lo que comparten las pestañas Fotos y Mensajes para revisar lo que mandan
// los participantes antes de que salga en la pantalla.

export const COLORES_ESTADO: Record<EstadoModeracion, string> = {
  pendiente: "bg-amber-50 text-amber-800",
  aprobada: "bg-emerald-50 text-emerald-800",
  rechazada: "bg-rose-50 text-rose-800",
};

const TEXTOS = {
  fotos: {
    leyenda: "Aprobación de fotos",
    clave: "fotos_moderacion",
    con: "Revisas cada foto y solo las aprobadas salen en la pantalla.",
    sin: "Cada foto sale en la pantalla apenas llega, sin revisión.",
    esperan: "Las fotos nuevas esperarán tu aprobación.",
    publican: "Las fotos nuevas se publican apenas llegan.",
    aprobarPendientes: (n: number) => (n === 1 ? "Aprobar la pendiente" : `Aprobar las ${n} pendientes`),
  },
  mensajes: {
    leyenda: "Aprobación de mensajes",
    clave: "mensajes_moderacion",
    con: "Revisas cada mensaje y solo los aprobados salen en la pantalla.",
    sin: "Cada mensaje sale en la pantalla apenas llega, sin revisión.",
    esperan: "Los mensajes nuevos esperarán tu aprobación.",
    publican: "Los mensajes nuevos se publican apenas llegan.",
    aprobarPendientes: (n: number) => (n === 1 ? "Aprobar el pendiente" : `Aprobar los ${n} pendientes`),
  },
} as const;

// Una sola regla para todo el evento: o cada aporte se revisa antes de salir
// en la pantalla, o sale apenas llega. Se guarda junto a la configuración del
// registro, como siempre estuvo la de las fotos.
export function Aprobacion({
  que,
  evento,
  onGuardado,
  pendientes,
  onAprobarPendientes,
}: {
  que: "fotos" | "mensajes";
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
  pendientes: number;
  onAprobarPendientes: () => void;
}) {
  const t = TEXTOS[que];
  const [moderacion, setModeracion] = useState(registroConfig(evento)[t.clave]);
  const [estado, setEstado] = useState("");

  async function elegir(valor: boolean) {
    if (valor === moderacion) return;
    setModeracion(valor);
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${evento.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registro_config: { ...registroConfig(evento), [t.clave]: valor } }),
    });
    if (!res.ok) {
      setModeracion(!valor);
      setEstado("No pudimos guardar el cambio.");
      return;
    }
    onGuardado(await res.json());
    setEstado(valor ? t.esperan : t.publican);
  }

  const opciones = [
    { valor: true, titulo: "Con aprobación", detalle: t.con },
    { valor: false, titulo: "Publicación automática", detalle: t.sin },
  ];
  return (
    <fieldset className="rounded-xl border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium">{t.leyenda}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {opciones.map((o) => (
          <label
            key={o.titulo}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
              moderacion === o.valor ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <input type="radio" name={`aprobacion-${que}`} checked={moderacion === o.valor} onChange={() => elegir(o.valor)} className="mt-0.5" />
            <span>
              <span className="block font-medium">{o.titulo}</span>
              <span className="block text-neutral-500">{o.detalle}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        {estado && <p role="status" className="text-neutral-500">{estado}</p>}
        {!moderacion && pendientes > 0 && (
          <button type="button" onClick={onAprobarPendientes} className="rounded-lg border border-emerald-300 px-3 py-1.5 font-medium text-emerald-800 hover:bg-emerald-50">
            {t.aprobarPendientes(pendientes)}
          </button>
        )}
      </div>
    </fieldset>
  );
}
