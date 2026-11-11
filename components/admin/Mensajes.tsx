"use client";

import { useState } from "react";
import type { EventoPanel } from "@/lib/eventos";
import type { EstadoModeracion } from "@/lib/moderacion";
import AjustesPantalla from "./AjustesPantalla";
import Descargas from "./Descargas";
import { Aprobacion, COLORES_ESTADO } from "./Moderacion";

export type Mensaje = { id: number; nombre: string; mensaje: string; estado: EstadoModeracion; created_at: string };

const ETIQUETAS: Record<EstadoModeracion, string> = { pendiente: "Pendiente", aprobada: "Aprobado", rechazada: "Rechazado" };
const BOTON = "rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-800";

export default function Mensajes({
  evento,
  mensajes,
  onCambio,
  onGuardado,
}: {
  evento: EventoPanel;
  mensajes: Mensaje[];
  onCambio: (mensajes: Mensaje[]) => void;
  onGuardado: (e: EventoPanel) => void;
}) {
  const slug = evento.slug;
  const [filtro, setFiltro] = useState<EstadoModeracion | "todos">("todos");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function cambiar(m: Mensaje, estado: EstadoModeracion) {
    if (ocupado !== null) return;
    setOcupado(m.id);
    setError("");
    setAviso("");
    try {
      const res = await fetch(`/api/eventos/${slug}/messages/${m.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos actualizar el mensaje.");
      onCambio(mensajes.map((x) => (x.id === m.id ? { ...x, estado } : x)));
      setAviso(estado === "aprobada" ? "Mensaje aprobado. Aparecerá en la pantalla en su próxima actualización." : "Mensaje rechazado. Dejará de mostrarse en la pantalla.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos actualizar el mensaje.");
    } finally {
      setOcupado(null);
    }
  }

  async function eliminar(m: Mensaje) {
    if (ocupado !== null || !window.confirm(`¿Eliminar el mensaje de ${m.nombre}? Esta acción no se puede deshacer.`)) return;
    setOcupado(m.id);
    setError("");
    setAviso("");
    try {
      const res = await fetch(`/api/eventos/${slug}/messages/${m.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos eliminar el mensaje.");
      onCambio(mensajes.filter((x) => x.id !== m.id));
      setAviso("Mensaje eliminado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos eliminar el mensaje.");
    } finally {
      setOcupado(null);
    }
  }

  async function aprobarPendientes() {
    setError("");
    setAviso("");
    const res = await fetch(`/api/eventos/${slug}/messages`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "aprobar_pendientes" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "No pudimos aprobar los mensajes.");
      return;
    }
    onCambio(mensajes.map((x) => (x.estado === "pendiente" ? { ...x, estado: "aprobada" } : x)));
    setAviso(`${data.aprobadas} ${data.aprobadas === 1 ? "mensaje aprobado" : "mensajes aprobados"}: aparecen en la pantalla en su próxima actualización.`);
  }

  const visibles = mensajes.filter((m) => filtro === "todos" || m.estado === filtro);
  const pendientes = mensajes.filter((m) => m.estado === "pendiente").length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Mensajes</h2>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Lo que escriben los participantes. En la pantalla en vivo cada mensaje sale en blanco con letra negra, para que se lea con cualquier paleta. La descarga trae todos los mensajes con su estado.
          </p>
        </div>
        <Descargas slug={slug} modulo="mensajes" />
      </div>

      <Aprobacion que="mensajes" evento={evento} onGuardado={onGuardado} pendientes={pendientes} onAprobarPendientes={aprobarPendientes} />
      <AjustesPantalla evento={evento} onGuardado={onGuardado} que="mensajes" />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {(["todos", "pendiente", "aprobada", "rechazada"] as const).map((estado) => (
          <button
            key={estado}
            type="button"
            onClick={() => setFiltro(estado)}
            aria-pressed={filtro === estado}
            className={`${BOTON} py-2 ${filtro === estado ? "border-neutral-800 bg-neutral-100" : "text-neutral-500"}`}
          >
            {estado === "todos" ? "Todos" : ETIQUETAS[estado]} ({estado === "todos" ? mensajes.length : mensajes.filter((m) => m.estado === estado).length})
          </button>
        ))}
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {aviso && <p role="status" className="text-sm text-neutral-600">{aviso}</p>}

      <div className="space-y-3">
        {mensajes.length === 0 && <p className="text-neutral-400">Aún no llegan mensajes.</p>}
        {mensajes.length > 0 && visibles.length === 0 && <p className="text-neutral-400">No hay mensajes con este estado.</p>}
        {visibles.map((m) => (
          <div key={m.id} className="rounded-xl border border-neutral-200 p-4" aria-busy={ocupado === m.id}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-medium">{m.nombre}</p>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORES_ESTADO[m.estado]}`}>{ETIQUETAS[m.estado]}</span>
                <p className="text-xs text-neutral-400">{m.created_at}</p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm text-neutral-700">{m.mensaje}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.estado !== "aprobada" && (
                <button type="button" onClick={() => void cambiar(m, "aprobada")} disabled={ocupado !== null} className={`${BOTON} border-emerald-200 text-emerald-800`}>
                  {ocupado === m.id ? "Guardando…" : "Aprobar"}
                </button>
              )}
              {m.estado !== "rechazada" && (
                <button type="button" onClick={() => void cambiar(m, "rechazada")} disabled={ocupado !== null} className={`${BOTON} text-rose-700`}>
                  Rechazar
                </button>
              )}
              <button type="button" onClick={() => void eliminar(m)} disabled={ocupado !== null} className={`${BOTON} text-neutral-500`} aria-label={`Eliminar el mensaje de ${m.nombre}`}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
