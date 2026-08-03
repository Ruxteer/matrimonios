"use client";

import { useRef, useState } from "react";
import type { Guest } from "@/lib/db";

const ESTADOS = ["pendiente", "confirmado", "rechazado"] as const;

const ESTADO_STYLE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  confirmado: "bg-emerald-100 text-emerald-800",
  rechazado: "bg-rose-100 text-rose-800",
};

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
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function deleteGuest(id: number) {
    if (!confirm("¿Eliminar este invitado?")) return;
    const res = await fetch(`/api/eventos/${slug}/guests/${id}`, { method: "DELETE" });
    if (res.ok) setGuests((gs) => gs.filter((g) => g.id !== id));
  }

  async function addGuest() {
    const nombre = prompt("Nombre del invitado:");
    if (!nombre?.trim()) return;
    const res = await fetch(`/api/eventos/${slug}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (res.ok) {
      const guest = await res.json();
      setGuests((gs) => [...gs, guest].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }
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

  const filtrados = guests.filter(
    (g) =>
      !filter ||
      g.nombre.toLowerCase().includes(filter.toLowerCase()) ||
      g.grupo.toLowerCase().includes(filter.toLowerCase()) ||
      g.mesa === filter
  );

  const mesas = new Set(guests.filter((g) => g.mesa).map((g) => g.mesa)).size;

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
          href="/api/guests/template"
          download
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          Descargar plantilla
        </a>
        <button
          onClick={addGuest}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          + Agregar invitado
        </button>
        <span className="ml-2 text-sm text-neutral-500">
          {mesas} mesas · {guests.filter((g) => g.estado === "confirmado").length}{" "}
          confirmados · {guests.filter((g) => g.estado === "pendiente").length} pendientes
        </span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar nombre, grupo o mesa…"
          className="ml-auto w-56 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {message && <p className="mb-3 text-sm text-neutral-600">{message}</p>}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Teléfono</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Grupo</th>
              <th className="px-3 py-2 font-medium">Mesa</th>
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
                    onClick={() => deleteGuest(g.id)}
                    className="text-neutral-400 hover:text-rose-600"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-neutral-400">
                  Sin invitados aún. Importa tu Excel o agrega uno manualmente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
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
