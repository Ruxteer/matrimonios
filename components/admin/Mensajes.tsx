"use client";

import type { EventoPanel } from "@/lib/eventos";
import AjustesPantalla from "./AjustesPantalla";

type Mensaje = { id: number; nombre: string; mensaje: string; created_at: string };

export default function Mensajes({
  evento,
  mensajes,
  onGuardado,
}: {
  evento: EventoPanel;
  mensajes: Mensaje[];
  onGuardado: (e: EventoPanel) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Mensajes</h2>
        <p className="mt-1 max-w-xl text-sm text-neutral-500">
          Lo que escriben los participantes. En la pantalla en vivo cada mensaje sale en blanco con letra negra, para que se lea con cualquier paleta.
        </p>
      </div>

      <AjustesPantalla evento={evento} onGuardado={onGuardado} que="mensajes" />

      <div className="space-y-3">
        {mensajes.length === 0 && <p className="text-neutral-400">Aún no llegan mensajes.</p>}
        {mensajes.map((m) => (
          <div key={m.id} className="rounded-xl border border-neutral-200 p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="font-medium">{m.nombre}</p>
              <p className="text-xs text-neutral-400">{m.created_at}</p>
            </div>
            <p className="whitespace-pre-wrap text-sm text-neutral-700">{m.mensaje}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
