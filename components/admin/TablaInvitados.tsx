"use client";

import { useEffect, useRef, useState } from "react";
import type { Guest } from "@/lib/db";

const ESTADOS = ["pendiente", "confirmado", "rechazado"] as const;

const ESTADO_STYLE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  confirmado: "bg-emerald-100 text-emerald-800",
  rechazado: "bg-rose-100 text-rose-800",
};

const BOTON = "rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50";

// Las fechas de SQLite vienen en UTC y sin zona: se muestran en la hora local.
function fechaHora(valor: string): string {
  const t = Date.parse(`${valor.replace(" ", "T")}Z`);
  if (Number.isNaN(t)) return valor;
  return new Date(t).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TablaInvitados({
  slug,
  guests,
  setGuests,
  recargar,
}: {
  slug: string;
  guests: Guest[];
  setGuests: (f: (gs: Guest[]) => Guest[]) => void;
  recargar: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [eliminados, setEliminados] = useState<Guest[]>([]);
  const [verEliminados, setVerEliminados] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // El historial de eliminados se pide al abrir la pestaña: el botón muestra
  // cuántos hay sin tener que abrirlo.
  useEffect(() => {
    let vigente = true;
    fetch(`/api/eventos/${slug}/guests?eliminados=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Guest[]) => vigente && setEliminados(lista))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [slug]);

  async function patchGuest(id: number, data: Partial<Guest>) {
    const res = await fetch(`/api/eventos/${slug}/guests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setGuests((gs) => gs.map((g) => (g.id === id ? updated : g)));
    }
  }

  async function deleteGuest(g: Guest) {
    if (!confirm(`¿Eliminar a ${g.nombre} de la lista? Queda en el historial de eliminados, desde donde se puede restaurar.`)) return;
    const res = await fetch(`/api/eventos/${slug}/guests/${g.id}`, { method: "DELETE" });
    if (!res.ok) {
      setMessage("No pudimos eliminar a esa persona.");
      return;
    }
    setGuests((gs) => gs.filter((x) => x.id !== g.id));
    // La hora exacta la pone el servidor; para la lista basta con la de ahora.
    const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
    setEliminados((es) => [{ ...g, eliminado_at: ahora }, ...es]);
    setMessage(`${g.nombre} se eliminó de la lista.`);
  }

  async function restaurar(g: Guest) {
    const res = await fetch(`/api/eventos/${slug}/guests/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurar: true }),
    });
    if (!res.ok) {
      setMessage("No pudimos restaurar a esa persona.");
      return;
    }
    const vuelta: Guest = await res.json();
    setEliminados((es) => es.filter((x) => x.id !== g.id));
    setGuests((gs) => [...gs, vuelta].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
    setMessage(`${g.nombre} volvió a la lista.`);
  }

  async function borrarDefinitivo(g: Guest) {
    if (!confirm(`¿Borrar definitivamente a ${g.nombre}? Sus datos se eliminan y no se pueden recuperar.`)) return;
    const res = await fetch(`/api/eventos/${slug}/guests/${g.id}?definitivo=1`, { method: "DELETE" });
    if (!res.ok) {
      setMessage("No pudimos borrar ese registro.");
      return;
    }
    setEliminados((es) => es.filter((x) => x.id !== g.id));
    setMessage(`${g.nombre} se borró definitivamente.`);
  }

  async function importExcel(file: File) {
    setMessage("Importando…");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/eventos/${slug}/guests/import`, {
      method: "POST",
      body: form,
    });
    const result = await res.json();
    if (!res.ok) {
      setMessage(`Error: ${result.error}`);
      return;
    }
    setMessage(
      `Importados: ${result.created} nuevos, ${result.updated} actualizados` +
        (result.errors?.length ? `, ${result.errors.length} errores` : "")
    );
    recargar();
  }

  const texto = filter.toLowerCase();
  const filtrados = guests.filter(
    (g) =>
      !filter ||
      g.nombre.toLowerCase().includes(texto) ||
      g.grupo.toLowerCase().includes(texto) ||
      g.mesa === filter
  );

  const sectores = new Set(guests.filter((g) => g.mesa).map((g) => g.mesa)).size;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          Importar Excel
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importExcel(f);
            e.target.value = "";
          }}
        />
        <a
          href={`/api/eventos/${slug}/guests/excel`}
          download
          title="Excel con todos los participantes y su estado. Se puede editar y volver a importar."
          className={BOTON}
        >
          Descargar plantilla
        </a>
        <button
          onClick={() => setAgregando((v) => !v)}
          aria-expanded={agregando}
          className={`${BOTON} ${agregando ? "border-neutral-900 bg-neutral-100" : ""}`}
        >
          + Agregar participante
        </button>
        <button
          onClick={() => setVerEliminados((v) => !v)}
          aria-expanded={verEliminados}
          className={`${BOTON} ${verEliminados ? "border-neutral-900 bg-neutral-100" : "text-neutral-500"}`}
        >
          Eliminados ({eliminados.length})
        </button>
        <span className="ml-2 text-sm text-neutral-500">
          {sectores} {sectores === 1 ? "sector" : "sectores"} ·{" "}
          {guests.filter((g) => g.estado === "confirmado").length} confirmados ·{" "}
          {guests.filter((g) => g.estado === "pendiente").length} pendientes
        </span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar nombre, grupo o sector…"
          aria-label="Buscar participantes"
          className="ml-auto w-56 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {agregando && (
        <AgregarParticipante
          slug={slug}
          onAgregado={(g) => {
            setGuests((gs) => [...gs, g].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
            setMessage(`${g.nombre} se agregó${g.mesa ? ` al sector ${g.mesa}` : ""}. Los demás datos se completan en la tabla.`);
          }}
          onCerrar={() => setAgregando(false)}
        />
      )}

      {message && <p role="status" className="mb-3 text-sm text-neutral-600">{message}</p>}

      {verEliminados && (
        <section aria-label="Participantes eliminados" className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="font-medium">Participantes eliminados</h3>
          <p className="mb-3 text-sm text-neutral-500">
            Quienes se sacaron de la lista, con la fecha y hora en que se eliminaron. Puedes devolverlos a la lista o borrar sus datos para siempre.
          </p>
          {eliminados.length === 0 ? (
            <p className="text-sm text-neutral-400">No hay participantes eliminados.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Sector</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Eliminado</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {eliminados.map((g) => (
                    <tr key={g.id} className="border-t border-neutral-100">
                      <td className="px-3 py-2">{g.nombre}</td>
                      <td className="px-3 py-2">{g.mesa || "—"}</td>
                      <td className="px-3 py-2">{g.estado}</td>
                      <td className="px-3 py-2 tabular-nums text-neutral-600">{fechaHora(g.eliminado_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button onClick={() => restaurar(g)} className="mr-3 text-neutral-700 underline hover:text-neutral-950">
                          Restaurar
                        </button>
                        <button onClick={() => borrarDefinitivo(g)} className="text-neutral-400 hover:text-rose-600">
                          Borrar definitivamente
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Teléfono</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Grupo</th>
              <th className="px-3 py-2 font-medium">Sector</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((g) => (
              <tr key={g.id} className="border-t border-neutral-100">
                <EditableCell guest={g} field="nombre" onSave={patchGuest} />
                <EditableCell guest={g} field="telefono" onSave={patchGuest} />
                <EditableCell guest={g} field="email" onSave={patchGuest} />
                <EditableCell guest={g} field="grupo" onSave={patchGuest} />
                <EditableCell guest={g} field="mesa" onSave={patchGuest} />
                <td className="px-3 py-2">
                  <select
                    value={g.estado}
                    onChange={(e) =>
                      patchGuest(g.id, { estado: e.target.value as Guest["estado"] })
                    }
                    aria-label={`Estado de ${g.nombre}`}
                    className={`rounded-full px-2 py-1 text-xs ${ESTADO_STYLE[g.estado]}`}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => deleteGuest(g)}
                    className="text-neutral-400 hover:text-rose-600"
                    title="Eliminar"
                    aria-label={`Eliminar a ${g.nombre}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-neutral-400">
                  {guests.length
                    ? "Nadie coincide con la búsqueda."
                    : "Sin participantes aún. Importa tu Excel o agrega uno con su nombre y sector."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Lo mínimo para sumar a alguien en la puerta: el nombre y su sector. El resto
// (teléfono, correo, grupo) se completa después en la tabla.
function AgregarParticipante({
  slug,
  onAgregado,
  onCerrar,
}: {
  slug: string;
  onAgregado: (g: Guest) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [sector, setSector] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const nombreRef = useRef<HTMLInputElement>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setEnviando(true);
    setError("");
    const res = await fetch(`/api/eventos/${slug}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, mesa: sector }),
    });
    setEnviando(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "No pudimos agregar a esa persona.");
      return;
    }
    onAgregado(data);
    // Se queda abierto y vacío: casi siempre se agregan varios seguidos.
    setNombre("");
    setSector("");
    nombreRef.current?.focus();
  }

  return (
    <form
      onSubmit={enviar}
      aria-label="Agregar participante"
      className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4"
    >
      <label className="min-w-56 flex-1 text-sm">
        <span className="mb-1 block text-neutral-500">Nombre del participante</span>
        <input
          ref={nombreRef}
          autoFocus
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="María Pérez"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
        />
      </label>
      <label className="w-36 text-sm">
        <span className="mb-1 block text-neutral-500">Sector</span>
        <input
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder="Ej: 4 o VIP"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={enviando || !nombre.trim()}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {enviando ? "Agregando…" : "Agregar"}
      </button>
      <button type="button" onClick={onCerrar} className="px-2 py-2 text-sm text-neutral-500 hover:text-neutral-800">
        Cerrar
      </button>
      {error && <p role="alert" className="w-full text-sm text-rose-600">{error}</p>}
    </form>
  );
}

function EditableCell({
  guest,
  field,
  onSave,
}: {
  guest: Guest;
  field: keyof Guest;
  onSave: (id: number, data: Partial<Guest>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(guest[field] ?? ""));
  const [prev, setPrev] = useState(guest[field]);

  if (prev !== guest[field]) {
    setPrev(guest[field]);
    setValue(String(guest[field] ?? ""));
  }

  function commit() {
    setEditing(false);
    const parsed = value.trim();
    if (parsed !== guest[field]) onSave(guest.id, { [field]: parsed });
  }

  return (
    <td className="cursor-text px-3 py-2" onClick={() => !editing && setEditing(true)}>
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(String(guest[field] ?? ""));
              setEditing(false);
            }
          }}
          className="w-full rounded border border-blue-300 px-1 py-0.5 outline-none"
        />
      ) : (
        <span className={value ? "" : "text-neutral-300"}>{value || "—"}</span>
      )}
    </td>
  );
}
