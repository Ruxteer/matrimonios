"use client";

import { useState } from "react";
import type { EventoPanel } from "@/lib/eventos";
import { CANTIDADES, pantallaConfig, type CantidadPantalla } from "@/lib/pantalla-config";

/** Enlace a la pantalla en vivo, con su clave: se abre sin pedir contraseña. */
export function urlPantallaEvento(evento: Pick<EventoPanel, "slug" | "pantalla_token">, ruta = "") {
  return `/pantalla/${evento.slug}${ruta}?k=${encodeURIComponent(evento.pantalla_token)}`;
}

export const BOTON_PANTALLA =
  "inline-flex items-center rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700";

// Cuántas fotos o mensajes muestra a la vez la pantalla en vivo. Se guarda al
// tocar: la pantalla lo recoge en su siguiente actualización, sin recargarla.
export default function AjustesPantalla({
  evento,
  onGuardado,
  que,
}: {
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
  que: "fotos" | "mensajes";
}) {
  const [cantidad, setCantidad] = useState<CantidadPantalla>(pantallaConfig(evento)[que]);
  const [estado, setEstado] = useState("");

  async function elegir(n: CantidadPantalla) {
    const anterior = cantidad;
    setCantidad(n);
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${evento.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pantalla_config: { [que]: n } }),
    });
    if (!res.ok) {
      setCantidad(anterior);
      setEstado("No pudimos guardar el cambio.");
      return;
    }
    onGuardado(await res.json());
    setEstado("Guardado: la pantalla lo toma en unos segundos.");
  }

  const palabra = que === "fotos" ? "fotos" : "mensajes";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-neutral-200 p-4">
      <div className="mr-auto">
        <p className="text-sm font-medium">{palabra === "fotos" ? "Fotos" : "Mensajes"} a la vez en la pantalla</p>
        <p className="text-xs text-neutral-500">
          {estado || `Cuántos ${palabra} se muestran juntos en cada vuelta de la pantalla en vivo.`}
        </p>
      </div>
      <div role="radiogroup" aria-label={`${palabra} a la vez en la pantalla`} className="flex overflow-hidden rounded-lg border border-neutral-300">
        {CANTIDADES.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={cantidad === n}
            onClick={() => cantidad !== n && elegir(n)}
            className={`w-11 py-2 text-sm font-medium tabular-nums ${
              cantidad === n ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"
            } border-l border-neutral-300 first:border-l-0`}
          >
            {n}
          </button>
        ))}
      </div>
      <a href={urlPantallaEvento(evento)} target="_blank" rel="noreferrer" className={BOTON_PANTALLA}>
        Ver pantalla ↗
      </a>
    </div>
  );
}
