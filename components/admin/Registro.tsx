"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { EventoPanel } from "@/lib/eventos";
import { normalizarRegistroConfig, registroConfig, urlRegistroValida, type RegistroConfig } from "@/lib/registro";

type Participante = {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  consentimiento_legal: boolean;
  consentimiento_informacion: boolean;
  consentimiento_marketing: boolean;
  campos_extra: Record<string, string>;
  consentimientos_at: string;
  created_at: string;
  fotos: number;
};
type Lista = { participantes: Participante[]; total: number; pagina: number; por_pagina: number };
const INPUT = "mt-1 block min-h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200";

function fechaLocal(valor: string) {
  if (!valor) return "";
  const fecha = new Date(valor);
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function fechaISO(valor: string) {
  return valor ? new Date(valor).toISOString() : "";
}
function fechaTabla(valor: string) {
  const fecha = new Date(valor.includes("T") ? valor : valor.replace(" ", "T") + "Z");
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export default function Registro({
  evento,
  onGuardado,
}: {
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
}) {
  const [config, setConfig] = useState<RegistroConfig>(() => registroConfig(evento));
  const [guardando, setGuardando] = useState(false);
  const [configAbierta, setConfigAbierta] = useState(() => {
    const inicial = registroConfig(evento);
    return !(urlRegistroValida(inicial.terminos_url) && urlRegistroValida(inicial.privacidad_url) && inicial.consentimiento_texto.trim());
  });
  const [estado, setEstado] = useState("");
  const [errorConfig, setErrorConfig] = useState("");
  const [buscar, setBuscar] = useState("");
  const [pagina, setPagina] = useState(1);
  const [revision, setRevision] = useState(0);
  const [lista, setLista] = useState<Lista>({ participantes: [], total: 0, pagina: 1, por_pagina: 25 });
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState("");
  const [exportando, setExportando] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCargando(true);
      setErrorLista("");
      const query = new URLSearchParams({ admin: "1", pagina: String(pagina), buscar });
      try {
        const res = await fetch(`/api/eventos/${encodeURIComponent(evento.slug)}/registro?${query}`, { cache: "no-store", signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No pudimos cargar los participantes.");
        setLista(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setErrorLista(err instanceof Error ? err.message : "No pudimos cargar los participantes.");
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }, buscar ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [evento.slug, pagina, buscar, revision]);

  function cambiar<K extends keyof RegistroConfig>(campo: K, valor: RegistroConfig[K]) {
    setConfig((actual) => ({ ...actual, [campo]: valor }));
    setEstado("");
    setErrorConfig("");
  }

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorConfig("");
    setEstado("");
    if (config.abierto && (!urlRegistroValida(config.terminos_url) || !urlRegistroValida(config.privacidad_url) || !config.consentimiento_texto.trim())) {
      setErrorConfig("Para abrir el registro, agrega los enlaces a los términos y la privacidad, y el texto de aceptación validado por la organización. Puedes guardar la configuración con el registro cerrado.");
      return;
    }
    if (config.inicio && config.fin && Date.parse(config.fin) <= Date.parse(config.inicio)) {
      setErrorConfig("La fecha de cierre debe ser posterior a la de apertura.");
      return;
    }
    if (config.campos_extra.some((campo) => !campo.label.trim())) {
      setErrorConfig("Escribe la etiqueta de cada campo adicional o elimina los campos vacíos.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/eventos/${encodeURIComponent(evento.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registro_config: JSON.parse(normalizarRegistroConfig(config)) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No pudimos guardar la configuración.");
      setConfig(registroConfig(data));
      onGuardado(data);
      setEstado("Configuración guardada.");
    } catch (err) {
      setErrorConfig(err instanceof Error ? err.message : "No pudimos guardar la configuración.");
    } finally {
      setGuardando(false);
    }
  }

  async function exportar(formato: "csv" | "xlsx") {
    setExportando(formato);
    setErrorLista("");
    try {
      const res = await fetch(`/api/eventos/${encodeURIComponent(evento.slug)}/registro?admin=1&formato=${formato}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No pudimos exportar los participantes.");
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `participantes-${evento.slug}.${formato}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : "No pudimos exportar los participantes.");
    } finally {
      setExportando("");
    }
  }

  const paginas = Math.max(1, Math.ceil(lista.total / lista.por_pagina));
  const legalListo = Boolean(urlRegistroValida(config.terminos_url) && urlRegistroValida(config.privacidad_url) && config.consentimiento_texto.trim());

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-busy={cargando}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-medium">Participantes ({lista.total})</h2><p className="mt-1 text-sm text-neutral-500">Datos, consentimientos y fotos asociadas a cada registro.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRevision((n) => n + 1)} disabled={cargando} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40">Actualizar</button>
            <button type="button" onClick={() => exportar("xlsx")} disabled={Boolean(exportando)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40">{exportando === "xlsx" ? "Exportando…" : "Descargar Excel"}</button>
            <button type="button" onClick={() => exportar("csv")} disabled={Boolean(exportando)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40">{exportando === "csv" ? "Exportando…" : "Descargar CSV"}</button>
          </div>
        </div>
        <label className="mb-4 block max-w-md text-sm">Buscar participante<input type="search" placeholder="Nombre, email o teléfono" value={buscar} onChange={(e) => { setBuscar(e.target.value); setPagina(1); }} className={INPUT} /></label>
        <p className="mb-3 text-xs text-neutral-500">Las descargas incluyen la base completa del evento, aunque tengas una búsqueda activa.</p>
        {errorLista && <p role="alert" className="mb-3 text-sm text-rose-700">{errorLista}</p>}
        {cargando ? <p role="status" className="py-8 text-sm text-neutral-500">Cargando participantes…</p> : !errorLista && (
          <>
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full min-w-[850px] text-left text-sm">
                <caption className="sr-only">Participantes registrados en el evento</caption>
                <thead className="bg-neutral-50 text-xs text-neutral-600"><tr><th scope="col" className="p-3">Nombre</th><th scope="col" className="p-3">Email / teléfono</th><th scope="col" className="p-3">Consentimientos</th><th scope="col" className="p-3">Campos adicionales</th><th scope="col" className="p-3">Fotos</th><th scope="col" className="p-3">Registro</th></tr></thead>
                <tbody className="divide-y divide-neutral-200">
                  {lista.participantes.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-500">{buscar ? "No encontramos participantes con esa búsqueda." : "Aún no hay participantes registrados."}</td></tr>}
                  {lista.participantes.map((p) => (
                    <tr key={p.id} className="align-top">
                      <th scope="row" className="max-w-48 break-words p-3 font-medium">{p.nombre}</th>
                      <td className="max-w-60 break-words p-3"><p>{p.email}</p><p className="mt-1 text-neutral-500">{p.telefono || "—"}</p></td>
                      <td className="p-3 text-xs leading-relaxed"><p>Legal: {p.consentimiento_legal ? "Sí" : "No"}</p><p>Información y fotos: {p.consentimiento_informacion ? "Sí" : "No"}</p><p>Marketing: {p.consentimiento_marketing ? "Sí" : "No"}</p>{p.consentimientos_at && <p className="mt-1 text-neutral-500">{fechaTabla(p.consentimientos_at)}</p>}</td>
                      <td className="max-w-60 break-words p-3 text-xs">{Object.entries(p.campos_extra ?? {}).map(([id, valor]) => <p key={id} className="mb-1"><span className="font-medium">{config.campos_extra.find((campo) => campo.id === id)?.label || id}:</span> {valor || "—"}</p>)}</td>
                      <td className="p-3 tabular-nums">{p.fotos ?? 0}</td>
                      <td className="whitespace-nowrap p-3 text-xs text-neutral-500">{fechaTabla(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-neutral-500">Página {lista.pagina} de {paginas} · {lista.total} participantes</p>
              <div className="flex gap-2"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)} className="rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-40">← Anterior</button><button type="button" disabled={pagina >= paginas} onClick={() => setPagina((n) => n + 1)} className="rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-40">Siguiente →</button></div>
            </div>
          </>
        )}
      </section>

      <details open={configAbierta} onToggle={(e) => setConfigAbierta(e.currentTarget.open)} className="rounded-xl border border-neutral-200">
        <summary className="cursor-pointer px-4 py-4 font-medium">
          Configurar registro y fotos
          {!legalListo && <span className="ml-3 text-xs font-normal text-amber-800">Completar documentos para abrir el registro</span>}
        </summary>
      <form onSubmit={guardar} className="max-w-3xl space-y-6 p-4">
        <div>
          <p className="mt-1 text-sm text-neutral-500">El participante deja sus datos desde el QR y continúa en el evento sin crear una cuenta.</p>
          <a href={`/${evento.slug}/registro`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">Ver formulario ↗</a>
        </div>
        <fieldset disabled={guardando} className="space-y-6 disabled:opacity-60">
          <legend className="sr-only">Configuración del registro</legend>
          <section className="rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 font-medium">Disponibilidad</h3>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.abierto} onChange={(e) => cambiar("abierto", e.target.checked)} className="h-4 w-4" />Aceptar registros</label>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="text-sm">Capacidad máxima<input type="number" min={0} max={1000000} step={1} value={config.capacidad} onChange={(e) => cambiar("capacidad", Number(e.target.value))} className={INPUT} /><span className="mt-1 block text-xs text-neutral-500">0: sin límite de participantes.</span></label>
              <label className="text-sm">Abre el<input type="datetime-local" value={fechaLocal(config.inicio)} onChange={(e) => cambiar("inicio", fechaISO(e.target.value))} className={INPUT} /></label>
              <label className="text-sm">Cierra el<input type="datetime-local" value={fechaLocal(config.fin)} onChange={(e) => cambiar("fin", fechaISO(e.target.value))} className={INPUT} /></label>
            </div>
            <p className="mt-2 text-xs text-neutral-500">Las fechas usan la hora local de este dispositivo. Déjalas vacías para abrir y cerrar manualmente.</p>
          </section>
          <section className="rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 font-medium">Textos del formulario</h3>
            <div className="space-y-4">
              <label className="block text-sm">Título<input maxLength={200} value={config.titulo} onChange={(e) => cambiar("titulo", e.target.value)} className={INPUT} /></label>
              <label className="block text-sm">Descripción<textarea rows={3} maxLength={2000} value={config.descripcion} onChange={(e) => cambiar("descripcion", e.target.value)} className={INPUT} /></label>
              <label className="block text-sm">Confirmación del registro<textarea rows={2} maxLength={2000} value={config.confirmacion} onChange={(e) => cambiar("confirmacion", e.target.value)} className={INPUT} /></label>
              <label className="block text-sm">Instrucción para continuar<input maxLength={300} value={config.siguiente_paso} onChange={(e) => cambiar("siguiente_paso", e.target.value)} className={INPUT} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.telefono_obligatorio} onChange={(e) => cambiar("telefono_obligatorio", e.target.checked)} className="h-4 w-4" />Teléfono obligatorio</label>
            </div>
          </section>
          <section className="rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-1 font-medium">Campos adicionales</h3>
            <p className="mb-3 text-sm text-neutral-500">Hasta 8 preguntas de respuesta corta, además de nombre, email y teléfono.</p>
            <div className="space-y-3">
              {config.campos_extra.map((campo, index) => (
                <div key={campo.id} className="flex flex-wrap items-end gap-3 rounded-lg bg-neutral-50 p-3">
                  <label className="min-w-40 flex-1 text-sm">Etiqueta del campo {index + 1}<input value={campo.label} maxLength={120} onChange={(e) => cambiar("campos_extra", config.campos_extra.map((actual) => actual.id === campo.id ? { ...actual, label: e.target.value } : actual))} className={INPUT} /></label>
                  <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={campo.obligatorio} onChange={(e) => cambiar("campos_extra", config.campos_extra.map((actual) => actual.id === campo.id ? { ...actual, obligatorio: e.target.checked } : actual))} />Obligatorio</label>
                  <button type="button" onClick={() => cambiar("campos_extra", config.campos_extra.filter((actual) => actual.id !== campo.id))} className="rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50" aria-label={`Eliminar campo ${campo.label || index + 1}`}>Eliminar</button>
                </div>
              ))}
            </div>
            <button type="button" disabled={config.campos_extra.length >= 8} onClick={() => cambiar("campos_extra", [...config.campos_extra, { id: `campo_${crypto.randomUUID().slice(0, 12)}`, label: "", obligatorio: false }])} className="mt-3 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40">+ Agregar campo</button>
          </section>
          <section className="rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-1 font-medium">Privacidad y consentimientos</h3>
            <p className="mb-4 text-sm text-neutral-500">Agrega los documentos y el texto de aceptación validados por la organización para abrir el registro. Los enlaces deben usar HTTPS o una ruta del sitio.</p>
            {!legalListo && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Faltan documentos o texto de aceptación. El formulario no recopilará datos hasta completar esta configuración.</p>}
            <div className="space-y-4">
              <label className="block text-sm">Enlace a términos y condiciones<input type="text" maxLength={2000} placeholder="https://… o /…" value={config.terminos_url} onChange={(e) => cambiar("terminos_url", e.target.value)} className={INPUT} /></label>
              <label className="block text-sm">Enlace a política de privacidad<input type="text" maxLength={2000} placeholder="https://… o /…" value={config.privacidad_url} onChange={(e) => cambiar("privacidad_url", e.target.value)} className={INPUT} /></label>
              <label className="block text-sm">Aceptación obligatoria<textarea rows={3} maxLength={2000} value={config.consentimiento_texto} onChange={(e) => cambiar("consentimiento_texto", e.target.value)} className={INPUT} /></label>
              <label className="block text-sm">Consentimiento opcional para información y fotos<textarea rows={2} maxLength={2000} value={config.informacion_texto} onChange={(e) => cambiar("informacion_texto", e.target.value)} className={INPUT} /><span className="mt-1 block text-xs text-neutral-500">Se muestra desmarcado. Déjalo vacío para ocultar esta opción.</span></label>
              <label className="block text-sm">Consentimiento opcional para marketing<textarea rows={2} maxLength={2000} value={config.marketing_texto} onChange={(e) => cambiar("marketing_texto", e.target.value)} className={INPUT} /><span className="mt-1 block text-xs text-neutral-500">Se muestra desmarcado. Déjalo vacío para ocultar esta opción.</span></label>
            </div>
            <p className="mt-4 text-xs text-neutral-500">El consentimiento queda registrado con el participante. El envío de información o fotos se realiza por los canales que tenga definidos la organización.</p>
          </section>
          <section className="rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 font-medium">Participación con fotos</h3>
            <label className="mb-4 block max-w-xs text-sm">Fotos máximas por participante<input type="number" min={1} max={100} step={1} value={config.fotos_por_participante} onChange={(e) => cambiar("fotos_por_participante", Number(e.target.value))} className={INPUT} /></label>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.fotos_requiere_registro} onChange={(e) => cambiar("fotos_requiere_registro", e.target.checked)} className="h-4 w-4" />Pedir registro antes de compartir fotos</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.fotos_moderacion} onChange={(e) => cambiar("fotos_moderacion", e.target.checked)} className="h-4 w-4" />Revisar y aprobar fotos antes de mostrarlas en la pantalla en vivo</label>
            </div>
          </section>
        </fieldset>
        {errorConfig && <p role="alert" className="text-sm text-rose-700">{errorConfig}</p>}
        {estado && <p role="status" className="text-sm text-emerald-700">{estado}</p>}
        <button type="submit" disabled={guardando} className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50">{guardando ? "Guardando…" : "Guardar configuración"}</button>
      </form>
      </details>
    </div>
  );
}
