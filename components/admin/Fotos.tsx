"use client";

import { useCallback, useEffect, useState } from "react";
import { urlArchivo } from "@/lib/urls";
import type { EstadoFoto, FotoAdmin } from "@/lib/fotos";
import type { EventoPanel } from "@/lib/eventos";
import { registroConfig } from "@/lib/registro";
import AjustesPantalla from "./AjustesPantalla";

const ETIQUETAS: Record<EstadoFoto, string> = { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada" };
const COLORES: Record<EstadoFoto, string> = {
  pendiente: "bg-amber-50 text-amber-800",
  aprobada: "bg-emerald-50 text-emerald-800",
  rechazada: "bg-rose-50 text-rose-800",
};
const BOTON = "rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-800";

async function obtenerFotos(slug: string): Promise<FotoAdmin[]> {
  const res = await fetch(`/api/eventos/${slug}/photos`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "No pudimos cargar las fotos.");
  return data;
}

export default function Fotos({
  evento,
  onGuardado,
}: {
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
}) {
  const slug = evento.slug;
  const [fotos, setFotos] = useState<FotoAdmin[]>([]);
  const [filtro, setFiltro] = useState<EstadoFoto | "todas">("todas");
  const [cargando, setCargando] = useState(true);
  const [ocupada, setOcupada] = useState<number | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerFotos(slug);
      setError("");
      setFotos(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar las fotos.");
    } finally {
      setCargando(false);
    }
  }, [slug]);

  useEffect(() => {
    let vigente = true;
    obtenerFotos(slug).then((data) => {
      if (vigente) setFotos(data);
    }).catch((e) => {
      if (vigente) setError(e instanceof Error ? e.message : "No pudimos cargar las fotos.");
    }).finally(() => {
      if (vigente) setCargando(false);
    });
    return () => { vigente = false; };
  }, [slug]);

  async function cambiar(foto: FotoAdmin, estado: EstadoFoto) {
    if (ocupada !== null) return;
    setOcupada(foto.id);
    setError("");
    setAviso("");
    try {
      const res = await fetch(`/api/eventos/${slug}/photos/${foto.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos actualizar la foto.");
      setFotos((anteriores) => anteriores.map((f) => f.id === foto.id ? { ...f, estado } : f));
      setAviso(estado === "aprobada" ? "Foto aprobada. Aparecerá en la pantalla en su próxima actualización." : "Foto rechazada. Dejará de mostrarse en la pantalla.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos actualizar la foto.");
    } finally {
      setOcupada(null);
    }
  }

  async function eliminar(foto: FotoAdmin) {
    if (ocupada !== null || !window.confirm("¿Eliminar esta foto y su archivo? Esta acción no se puede deshacer.")) return;
    setOcupada(foto.id);
    setError("");
    setAviso("");
    try {
      const res = await fetch(`/api/eventos/${slug}/photos/${foto.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos eliminar la foto.");
      setFotos((anteriores) => anteriores.filter((f) => f.id !== foto.id));
      setAviso("Foto eliminada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos eliminar la foto.");
    } finally {
      setOcupada(null);
    }
  }

  async function descargar() {
    setDescargando(true);
    setError("");
    setAviso("");
    try {
      const res = await fetch(`/api/eventos/${slug}/photos/archivo`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No pudimos preparar la descarga.");
      }
      const url = URL.createObjectURL(await res.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `${slug}-fotos.zip`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setAviso("Descarga preparada: fotos y planilla con su participante, estado y fecha.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos descargar las fotos.");
    } finally {
      setDescargando(false);
    }
  }

  async function aprobarPendientes() {
    setError("");
    setAviso("");
    const res = await fetch(`/api/eventos/${slug}/photos`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "aprobar_pendientes" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "No pudimos aprobar las fotos.");
      return;
    }
    setFotos((anteriores) => anteriores.map((f) => f.estado === "pendiente" ? { ...f, estado: "aprobada" } : f));
    setAviso(`${data.aprobadas} ${data.aprobadas === 1 ? "foto aprobada" : "fotos aprobadas"}: aparecen en la pantalla en su próxima actualización.`);
  }

  const visibles = fotos.filter((f) => filtro === "todas" || f.estado === filtro);
  const pendientes = fotos.filter((f) => f.estado === "pendiente").length;
  return (
    <section aria-label="Moderación de fotos" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Fotos del evento</h2>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">Las fotos que comparten los participantes. La descarga incluye todas las fotos y una planilla con sus datos.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setCargando(true); void cargar(); }} disabled={cargando || ocupada !== null} className={BOTON}>{cargando ? "Cargando…" : "Actualizar"}</button>
          <button type="button" onClick={() => void descargar()} disabled={cargando || descargando || !fotos.length} className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-800">{descargando ? "Preparando ZIP…" : "Descargar todas (ZIP)"}</button>
        </div>
      </div>
      <Aprobacion evento={evento} onGuardado={onGuardado} pendientes={pendientes} onAprobarPendientes={aprobarPendientes} />
      <AjustesPantalla evento={evento} onGuardado={onGuardado} que="fotos" />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {(["todas", "pendiente", "aprobada", "rechazada"] as const).map((estado) => (
          <button key={estado} type="button" onClick={() => setFiltro(estado)} aria-pressed={filtro === estado} className={`${BOTON} ${filtro === estado ? "border-neutral-800 bg-neutral-100" : "text-neutral-500"}`}>
            {estado === "todas" ? "Todas" : ETIQUETAS[estado]} ({estado === "todas" ? fotos.length : fotos.filter((f) => f.estado === estado).length})
          </button>
        ))}
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <p role="status" className="text-sm text-neutral-600">{aviso}</p>
      {cargando && !fotos.length ? <p className="py-8 text-neutral-500">Cargando fotos…</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!visibles.length && <p className="col-span-full rounded-xl border border-dashed border-neutral-200 p-8 text-center text-neutral-500">{fotos.length ? "No hay fotos con este estado." : "Las fotos compartidas aparecerán aquí."}</p>}
          {visibles.map((foto) => (
            <article key={foto.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white" aria-busy={ocupada === foto.id}>
              <a href={urlArchivo(foto.archivo)} target="_blank" rel="noreferrer" className="block bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-800" aria-label={`Ver foto ${foto.id} de ${foto.participante_nombre || "una persona sin registro"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlArchivo(foto.archivo)} alt={`Foto compartida por ${foto.participante_nombre || "una persona sin registro"}`} className="aspect-square w-full object-cover" loading="lazy" />
              </a>
              <div className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={foto.participante_nombre}>{foto.participante_nombre || "Sin registro"}</p>
                    {foto.participante_email && <p className="truncate text-xs text-neutral-500" title={foto.participante_email}>{foto.participante_email}</p>}
                    <p className="mt-1 text-xs text-neutral-400">#{foto.id} · {foto.created_at}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${COLORES[foto.estado]}`}>{ETIQUETAS[foto.estado]}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {foto.estado !== "aprobada" && <button type="button" onClick={() => void cambiar(foto, "aprobada")} disabled={ocupada !== null} className={`${BOTON} border-emerald-200 text-emerald-800`}>{ocupada === foto.id ? "Guardando…" : "Aprobar"}</button>}
                  {foto.estado !== "rechazada" && <button type="button" onClick={() => void cambiar(foto, "rechazada")} disabled={ocupada !== null} className={`${BOTON} text-rose-700`}>Rechazar</button>}
                  <a href={`/api/eventos/${slug}/photos/${foto.id}`} className={BOTON}>Descargar</a>
                  <button type="button" onClick={() => void eliminar(foto)} disabled={ocupada !== null} className={`${BOTON} text-neutral-500`} aria-label={`Eliminar foto ${foto.id}`}>Eliminar</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// Una sola regla para todo el evento: o cada foto se revisa antes de salir en
// la pantalla, o sale apenas llega. Es el mismo ajuste que la pestaña Registro.
function Aprobacion({
  evento,
  onGuardado,
  pendientes,
  onAprobarPendientes,
}: {
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
  pendientes: number;
  onAprobarPendientes: () => void;
}) {
  const [moderacion, setModeracion] = useState(registroConfig(evento).fotos_moderacion);
  const [estado, setEstado] = useState("");

  async function elegir(valor: boolean) {
    if (valor === moderacion) return;
    setModeracion(valor);
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${evento.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registro_config: { ...registroConfig(evento), fotos_moderacion: valor } }),
    });
    if (!res.ok) {
      setModeracion(!valor);
      setEstado("No pudimos guardar el cambio.");
      return;
    }
    onGuardado(await res.json());
    setEstado(valor ? "Las fotos nuevas esperarán tu aprobación." : "Las fotos nuevas se publican apenas llegan.");
  }

  const opciones = [
    { valor: true, titulo: "Con aprobación", detalle: "Revisas cada foto y solo las aprobadas salen en la pantalla." },
    { valor: false, titulo: "Publicación automática", detalle: "Cada foto sale en la pantalla apenas llega, sin revisión." },
  ];
  return (
    <fieldset className="rounded-xl border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium">Aprobación de fotos</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {opciones.map((o) => (
          <label
            key={o.titulo}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
              moderacion === o.valor ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <input type="radio" name="aprobacion-fotos" checked={moderacion === o.valor} onChange={() => elegir(o.valor)} className="mt-0.5" />
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
            Aprobar las {pendientes} pendientes
          </button>
        )}
      </div>
    </fieldset>
  );
}
