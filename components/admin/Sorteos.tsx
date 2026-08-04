"use client";

import { useCallback, useEffect, useState } from "react";
import type { Sorteo } from "@/lib/db";

type SorteoAdmin = Sorteo & { participantes: number };

// El documento del módulo también menciona sortear entre quienes subieron
// fotos, pero la tabla photos no guarda quién subió cada imagen.
const FUENTES = [
  { valor: "invitados", label: "Todos los invitados" },
  { valor: "mensajes", label: "Quienes dejaron un mensaje" },
  { valor: "lista", label: "Una lista escrita aquí" },
];

// ejecutado_at viene de SQLite en UTC y sin zona horaria.
function hora(ejecutado_at: string): string {
  if (!ejecutado_at) return "";
  return new Date(`${ejecutado_at.replace(" ", "T")}Z`).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function leerGanadores(json: string): string[] {
  try {
    const valor = JSON.parse(json || "[]");
    return Array.isArray(valor)
      ? valor.filter((n): n is string => typeof n === "string")
      : [];
  } catch {
    return [];
  }
}

export default function Sorteos({ slug }: { slug: string }) {
  const [sorteos, setSorteos] = useState<SorteoAdmin[]>([]);
  const [estado, setEstado] = useState("");

  const cargar = useCallback(() => {
    fetch(`/api/eventos/${slug}/sorteos`).then(async (res) => {
      if (res.ok) setSorteos(await res.json());
    });
  }, [slug]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear() {
    const titulo = prompt("¿Cómo se llama el sorteo?");
    if (!titulo?.trim()) return;
    const res = await fetch(`/api/eventos/${slug}/sorteos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    });
    if (!res.ok) {
      setEstado("No pudimos crear el sorteo.");
      return;
    }
    setEstado("Sorteo creado: completa el premio y quiénes participan.");
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={crear}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          Nuevo sorteo
        </button>
        <p className="text-sm text-neutral-500">
          Los sorteos publicados se ven en /{slug}/sorteo. Los ganadores aparecen
          recién cuando ejecutas el sorteo.
        </p>
      </div>

      {sorteos.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no hay sorteos.</p>
      ) : (
        sorteos.map((sorteo) => (
          <Ficha
            key={sorteo.id}
            slug={slug}
            sorteo={sorteo}
            recargar={cargar}
            avisar={setEstado}
          />
        ))
      )}

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}
    </div>
  );
}

function Ficha({
  slug,
  sorteo,
  recargar,
  avisar,
}: {
  slug: string;
  sorteo: SorteoAdmin;
  recargar: () => void;
  avisar: (mensaje: string) => void;
}) {
  const [form, setForm] = useState(sorteo);
  const [ocupado, setOcupado] = useState(false);

  const ganadores = leerGanadores(sorteo.ganadores);
  // El total de participantes lo calcula el servidor, así que mientras haya
  // cambios sin guardar el número de pantalla no corresponde.
  const sinGuardar = form.fuente !== sorteo.fuente || form.lista !== sorteo.lista;

  async function guardar() {
    setOcupado(true);
    const res = await fetch(`/api/eventos/${slug}/sorteos/${sorteo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: form.titulo,
        premio: form.premio,
        fuente: form.fuente,
        lista: form.lista,
        cantidad: form.cantidad,
        excluir_anteriores: form.excluir_anteriores,
        publicado: form.publicado,
      }),
    });
    setOcupado(false);
    avisar(res.ok ? "Sorteo guardado" : "No pudimos guardar el sorteo.");
    if (res.ok) recargar();
  }

  async function ejecutar() {
    if (
      ganadores.length > 0 &&
      !confirm(
        `"${sorteo.titulo}" ya tiene ganadores. Volver a ejecutarlo los reemplaza. ¿Seguir?`
      )
    ) {
      return;
    }
    setOcupado(true);
    const res = await fetch(`/api/eventos/${slug}/sorteos/${sorteo.id}/ejecutar`, {
      method: "POST",
    });
    const data = await res.json().catch(() => null);
    setOcupado(false);
    if (!res.ok) {
      avisar(data?.error ?? "No pudimos ejecutar el sorteo.");
      return;
    }
    avisar(`Sorteo ejecutado entre ${data.disponibles} participantes.`);
    recargar();
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar el sorteo "${sorteo.titulo}"? También se borran sus ganadores.`))
      return;
    const res = await fetch(`/api/eventos/${slug}/sorteos/${sorteo.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      avisar("No pudimos eliminar el sorteo.");
      return;
    }
    avisar("Sorteo eliminado");
    recargar();
  }

  return (
    <section className="space-y-3 rounded-xl border border-neutral-200 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Nombre del sorteo</span>
          <input
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Premio</span>
          <input
            value={form.premio}
            onChange={(e) => setForm({ ...form, premio: e.target.value })}
            placeholder="Una noche en el hotel"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Participan</span>
          <select
            value={form.fuente}
            onChange={(e) =>
              setForm({ ...form, fuente: e.target.value as Sorteo["fuente"] })
            }
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          >
            {FUENTES.map(({ valor, label }) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Cuántos ganadores</span>
          <input
            type="number"
            min={1}
            max={50}
            value={form.cantidad}
            onChange={(e) =>
              setForm({ ...form, cantidad: Number(e.target.value) || 1 })
            }
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <div className="flex flex-col justify-end gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.excluir_anteriores === 1}
              onChange={(e) =>
                setForm({ ...form, excluir_anteriores: e.target.checked ? 1 : 0 })
              }
            />
            No repetir quien ya ganó
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.publicado === 1}
              onChange={(e) =>
                setForm({ ...form, publicado: e.target.checked ? 1 : 0 })
              }
            />
            Mostrarlo a los invitados
          </label>
        </div>
      </div>

      {form.fuente === "lista" && (
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">
            Los participantes, un nombre por línea
          </span>
          <textarea
            value={form.lista}
            onChange={(e) => setForm({ ...form, lista: e.target.value })}
            rows={5}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
          />
        </label>
      )}

      <p className="text-sm text-neutral-500">
        {sinGuardar
          ? "Guarda para saber cuántos participan."
          : `${sorteo.participantes} participantes en esta fuente.`}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={guardar}
          disabled={ocupado}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          onClick={ejecutar}
          disabled={ocupado}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          {ganadores.length > 0 ? "Sortear de nuevo" : "Ejecutar sorteo"}
        </button>
        <button
          onClick={eliminar}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
        >
          Eliminar
        </button>
      </div>

      {ganadores.length > 0 && (
        <div className="rounded-lg bg-neutral-100 p-3">
          <p className="text-xs text-neutral-500">
            Ganadores del {hora(sorteo.ejecutado_at)}
          </p>
          <ul className="mt-1 space-y-0.5">
            {ganadores.map((nombre) => (
              <li key={nombre} className="text-sm font-medium">
                {nombre}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
