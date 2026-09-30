"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Login from "@/components/admin/Login";
import { modulosActivos } from "@/lib/modulos";
import { etiquetaEvento } from "@/lib/identidad";
import type { Evento } from "@/lib/db";

type Resumen = { participantes?: number; invitados: number; mesas: number; mensajes: number; fotos: number };
type EventoConResumen = Evento & { resumen: Resumen };

export default function AdminInicio() {
  const router = useRouter();
  const [eventos, setEventos] = useState<EventoConResumen[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({ tipo: "activacion", titulo: "", descripcion: "", nombre1: "", nombre2: "", fecha: "" });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/eventos").then(async (r) => {
      if (r.status === 401) {
        setAuthed(false);
        return;
      }
      setEventos(await r.json());
      setAuthed(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevo),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No pudimos crear el evento.");
      return;
    }
    router.push(`/admin/${data.slug}`);
  }

  async function salir() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  if (authed === false) return <Login onOk={load} />;
  if (authed === null) return <p className="p-6 text-neutral-500">Cargando…</p>;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="mb-1 text-2xl font-semibold">Eventos Venito</h1>
        <button onClick={salir} className="text-sm text-neutral-400 hover:text-neutral-700">
          Cerrar sesión
        </button>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Matrimonios y activaciones, cada uno con su dirección, QR y participantes.
      </p>

      <div className="space-y-3">
        {eventos.map((e) => (
          <Link
            key={e.id}
            href={`/admin/${e.slug}`}
            className="block rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-400"
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-medium">
                {e.tipo === "activacion" ? "" : "Matrimonio de "}{etiquetaEvento(e)}
              </p>
              <p className="text-sm text-neutral-500">{e.fecha || "sin fecha"}</p>
            </div>
            <p className="mt-1 font-mono text-xs text-neutral-400">/{e.slug}</p>
            <p className="mt-2 text-xs text-neutral-500">
              {e.resumen.participantes ?? 0} registros · {e.tipo === "activacion" ? "" : `${e.resumen.invitados} invitados · `}
              {e.resumen.mensajes} mensajes · {e.resumen.fotos} fotos ·{" "}
              {modulosActivos(e).length} módulos
            </p>
          </Link>
        ))}
        {eventos.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
            Aún no hay eventos. Crea el primero abajo.
          </p>
        )}
      </div>

      {creando ? (
        <form onSubmit={crear} className="mt-6 rounded-xl border border-neutral-200 p-4">
          <p className="mb-3 font-medium">Nuevo evento</p>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block">Tipo de experiencia</span>
            <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} className="w-full rounded-lg border border-neutral-300 p-2">
              <option value="matrimonio">Matrimonio</option>
              <option value="activacion">Activación de marca o evento</option>
            </select>
          </label>
          {nuevo.tipo === "activacion" && <div className="mb-3 space-y-3">
            <label className="block text-sm">Nombre del evento
              <input required value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 p-2" />
            </label>
            <label className="block text-sm">Mensaje de bienvenida
              <textarea value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 p-2" />
            </label>
          </div>}
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <input
              value={nuevo.nombre1}
              onChange={(ev) => setNuevo({ ...nuevo, nombre1: ev.target.value })}
              placeholder="Nombre de la novia"
              aria-label="Nombre de la novia"
              hidden={nuevo.tipo === "activacion"}
              required={nuevo.tipo === "matrimonio"}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              value={nuevo.nombre2}
              onChange={(ev) => setNuevo({ ...nuevo, nombre2: ev.target.value })}
              placeholder="Nombre del novio"
              aria-label="Nombre del novio"
              hidden={nuevo.tipo === "activacion"}
              required={nuevo.tipo === "matrimonio"}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              value={nuevo.fecha}
              onChange={(ev) => setNuevo({ ...nuevo, fecha: ev.target.value })}
              placeholder="Fecha del evento"
              aria-label="Fecha del evento"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => setCreando(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreando(true)}
          className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          + Nuevo evento
        </button>
      )}
    </main>
  );
}
