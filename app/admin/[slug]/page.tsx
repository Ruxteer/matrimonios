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
import Fotos from "@/components/admin/Fotos";
import Registro from "@/components/admin/Registro";
import Mapa from "@/components/admin/Mapa";
import Mensajes from "@/components/admin/Mensajes";
import { etiquetaEvento } from "@/lib/identidad";
import { modulosDeEvento, type ModuloId } from "@/lib/modulos";
import type { Guest } from "@/lib/db";
import type { EventoPanel } from "@/lib/eventos";

type Mensaje = { id: number; nombre: string; mensaje: string; created_at: string };
type Tab = ModuloId | "invitados" | "modulos" | "ajustes";

export default function AdminEvento() {
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<Tab | null>(null);
  const [evento, setEvento] = useState<EventoPanel | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [existe, setExiste] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  function actualizarVista(actualizado: EventoPanel) {
    setEvento((anterior) => ({
      ...actualizado,
      maestra: actualizado.maestra ?? anterior?.maestra,
      cliente: actualizado.cliente ?? anterior?.cliente,
    }));
  }

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/eventos/${slug}`),
      fetch(`/api/eventos/${slug}/guests`),
      fetch(`/api/eventos/${slug}/messages`),
    ]).then(async ([re, rg, rm]) => {
      setErrorCarga("");
      if (re.status === 404) {
        setExiste(false);
        setAuthed(true);
        return;
      }
      if (rg.status === 401) {
        setAuthed(false);
        return;
      }
      if (!re.ok || !rg.ok || !rm.ok) throw new Error("No pudimos cargar el evento.");
      const datos: EventoPanel = await re.json();
      setEvento(datos);
      setGuests(await rg.json());
      setMensajes(await rm.json());
      setAuthed(true);
    }).catch(() => setErrorCarga("No pudimos cargar el evento. Revisa tu conexión e intenta otra vez."));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (errorCarga) return <main className="mx-auto max-w-md p-6"><p role="alert">{errorCarga}</p><button onClick={load} className="mt-4 rounded-lg border p-3">Reintentar</button></main>;
  if (authed === false) return <Login onOk={load} slug={slug} />;
  if (authed === null) return <p className="p-6 text-neutral-500">Cargando…</p>;
  if (!existe) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="mb-4">Ese evento no existe.</p>
        <Link href="/admin" className="underline">
          Ver todos los clientes
        </Link>
      </main>
    );
  }
  if (!evento) return <p className="p-6 text-neutral-500">Cargando…</p>;

  // Las pestañas siguen a los módulos encendidos y su orden: lo que el
  // matrimonio no usa no aparece en el panel. Mesa se administra desde
  // Invitados, así que no tiene pestaña propia. Mapa aparece apenas se
  // enciende, aunque falte el plano: es justo ahí donde se sube.
  const encendidos = modulosDeEvento(evento).filter((f) => f.activo).map((f) => f.modulo);
  const mostrarInvitados = evento.tipo !== "activacion" || encendidos.some((m) => m.id === "mesa");
  const conPanel = encendidos.filter((m) => m.id !== "mesa");
  const etiquetas: Partial<Record<ModuloId, string>> = {
    mensajes: `Mensajes (${mensajes.length})`,
    registro: "Registro",
  };
  const pestañas: [Tab, string][] = [
    ...(mostrarInvitados ? [["invitados", `Participantes (${guests.length})`] as [Tab, string]] : []),
    ...conPanel.map((m): [Tab, string] => [m.id, etiquetas[m.id] ?? m.nombre]),
    ["modulos", "Módulos"],
    ["ajustes", "Ajustes"],
  ];
  // Al apagar un módulo su pestaña desaparece: hay que volver a una que exista.
  const predeterminada: Tab = evento.tipo === "activacion" && conPanel.some((m) => m.id === "registro") ? "registro" : pestañas[0][0];
  const actual = pestañas.some(([key]) => key === tab) ? tab : predeterminada;

  return (
    <main className="mx-auto max-w-6xl p-6">
      {/* Los novios solo tienen su matrimonio: la lista completa no es para ellos. */}
      {evento.maestra ? (
        <Link
          href={evento.cliente ? `/admin/clientes/${evento.cliente.slug}` : "/admin"}
          className="text-sm text-neutral-400 hover:text-neutral-700"
        >
          ← {evento.cliente ? `Eventos de ${evento.cliente.nombre}` : "Todos los clientes"}
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
          {evento.tipo === "activacion" ? "" : "Matrimonio de "}{etiquetaEvento(evento)}
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

      {actual === "mensajes" && <Mensajes evento={evento} mensajes={mensajes} onGuardado={actualizarVista} />}

      {actual === "fotos" && <Fotos evento={evento} onGuardado={actualizarVista} />}
      {actual === "mapa" && <Mapa evento={evento} onGuardado={actualizarVista} />}
      {actual === "registro" && <Registro evento={evento} onGuardado={actualizarVista} />}

      {actual === "agenda" && <Agenda slug={evento.slug} />}
      {actual === "encuestas" && <Encuestas slug={evento.slug} />}
      {actual === "votaciones" && <Votaciones evento={evento} />}
      {actual === "sorteos" && <Sorteos evento={evento} />}
      {actual === "trivia" && <Trivia slug={evento.slug} />}

      {actual === "modulos" && <Modulos evento={evento} onGuardado={actualizarVista} />}
      {actual === "ajustes" && <Ajustes evento={evento} onGuardado={actualizarVista} />}
    </main>
  );
}
