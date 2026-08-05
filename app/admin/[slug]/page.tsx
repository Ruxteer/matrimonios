"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Login from "@/components/admin/Login";
import TablaInvitados from "@/components/admin/TablaInvitados";
import Ajustes from "@/components/admin/Ajustes";
import Modulos from "@/components/admin/Modulos";
import Agenda from "@/components/admin/Agenda";
import Encuestas from "@/components/admin/Encuestas";
import Votaciones from "@/components/admin/Votaciones";
import Sorteos from "@/components/admin/Sorteos";
import Trivia from "@/components/admin/Trivia";
import { urlArchivo } from "@/lib/urls";
import { modulosActivos, type ModuloId } from "@/lib/modulos";
import type { Guest } from "@/lib/db";
import type { EventoPanel } from "@/lib/eventos";

type Mensaje = { id: number; nombre: string; mensaje: string; created_at: string };
type Foto = { id: number; archivo: string; created_at: string };
type Tab = ModuloId | "invitados" | "modulos" | "ajustes";

export default function AdminEvento() {
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<Tab>("invitados");
  const [evento, setEvento] = useState<EventoPanel | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [existe, setExiste] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/eventos/${slug}`),
      fetch(`/api/eventos/${slug}/guests`),
      fetch(`/api/eventos/${slug}/messages`),
      fetch(`/api/eventos/${slug}/photos`),
    ]).then(async ([re, rg, rm, rf]) => {
      if (re.status === 404) {
        setExiste(false);
        setAuthed(true);
        return;
      }
      if (rg.status === 401) {
        setAuthed(false);
        return;
      }
      setEvento(await re.json());
      setGuests(await rg.json());
      setMensajes(await rm.json());
      setFotos(await rf.json());
      setAuthed(true);
    });
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function borrarFoto(id: number) {
    if (!confirm("¿Eliminar esta foto? No se puede deshacer.")) return;
    const res = await fetch(`/api/eventos/${slug}/photos/${id}`, { method: "DELETE" });
    if (res.ok) setFotos((fs) => fs.filter((f) => f.id !== id));
  }

  if (authed === false) return <Login onOk={load} slug={slug} />;
  if (authed === null) return <p className="p-6 text-neutral-500">Cargando…</p>;
  if (!existe) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="mb-4">Ese matrimonio no existe.</p>
        <Link href="/admin" className="underline">
          Ver todos los matrimonios
        </Link>
      </main>
    );
  }
  if (!evento) return <p className="p-6 text-neutral-500">Cargando…</p>;

  // Las pestañas siguen a los módulos encendidos y su orden: lo que el
  // matrimonio no usa no aparece en el panel. Mesa se administra desde
  // Invitados y Mapa desde Ajustes, así que no tienen pestaña propia.
  const conPanel = modulosActivos(evento).filter(
    (m) => m.id !== "mesa" && m.id !== "mapa"
  );
  const etiquetas: Partial<Record<ModuloId, string>> = {
    mensajes: `Mensajes (${mensajes.length})`,
    fotos: `Fotos (${fotos.length})`,
  };
  const pestañas: [Tab, string][] = [
    ["invitados", `Invitados (${guests.length})`],
    ...conPanel.map((m): [Tab, string] => [m.id, etiquetas[m.id] ?? m.nombre]),
    ["modulos", "Módulos"],
    ["ajustes", "Ajustes"],
  ];
  // Al apagar un módulo su pestaña desaparece: hay que volver a una que exista.
  const actual = pestañas.some(([key]) => key === tab) ? tab : "invitados";

  return (
    <main className="mx-auto max-w-6xl p-6">
      {/* Los novios solo tienen su matrimonio: la lista completa no es para ellos. */}
      {evento.maestra ? (
        <Link href="/admin" className="text-sm text-neutral-400 hover:text-neutral-700">
          ← Todos los matrimonios
        </Link>
      ) : (
        <button
          onClick={async () => {
            await fetch("/api/admin/login", { method: "DELETE" });
            setAuthed(false);
          }}
          className="text-sm text-neutral-400 hover:text-neutral-700"
        >
          Cerrar sesión
        </button>
      )}

      {/* Identidad del matrimonio que se está administrando */}
      <div className="mb-5 mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-neutral-200 pb-4">
        <h1 className="text-2xl font-semibold">
          Matrimonio de {evento.nombre1} y {evento.nombre2}
        </h1>
        {evento.fecha && <span className="text-neutral-500">{evento.fecha}</span>}
        <a
          href={`/${evento.slug}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto font-mono text-sm text-neutral-500 underline hover:text-neutral-800"
        >
          /{evento.slug} ↗
        </a>
      </div>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-neutral-200">
        {pestañas.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-t-lg px-4 py-2 text-sm ${
              actual === key
                ? "border border-b-0 border-neutral-200 bg-white font-medium"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {actual === "invitados" && (
        <TablaInvitados
          slug={evento.slug}
          guests={guests}
          setGuests={(f) => setGuests(f)}
          recargar={load}
        />
      )}

      {actual === "mensajes" && (
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
      )}

      {actual === "fotos" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {fotos.length === 0 && (
            <p className="col-span-full text-neutral-400">Aún no suben fotos.</p>
          )}
          {fotos.map((f) => (
            <div key={f.id} className="group relative">
              <a
                href={urlArchivo(f.archivo)}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl border border-neutral-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlArchivo(f.archivo)}
                  alt={`Foto ${f.id}`}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              </a>
              <button
                onClick={() => borrarFoto(f.id)}
                title="Eliminar foto"
                aria-label={`Eliminar foto ${f.id}`}
                className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-sm text-neutral-500 opacity-0 shadow transition group-hover:opacity-100 hover:text-rose-600 focus:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {actual === "agenda" && <Agenda slug={evento.slug} />}
      {actual === "encuestas" && <Encuestas slug={evento.slug} />}
      {actual === "votaciones" && <Votaciones slug={evento.slug} />}
      {actual === "sorteos" && <Sorteos slug={evento.slug} />}
      {actual === "trivia" && <Trivia slug={evento.slug} />}

      {actual === "modulos" && <Modulos evento={evento} onGuardado={setEvento} />}
      {actual === "ajustes" && <Ajustes evento={evento} onGuardado={setEvento} />}
    </main>
  );
}
