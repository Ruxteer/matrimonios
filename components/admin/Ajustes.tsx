"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Evento } from "@/lib/db";

const COLORES: { campo: keyof Evento; label: string }[] = [
  { campo: "color_fondo", label: "Fondo" },
  { campo: "color_rosa", label: "Botones" },
  { campo: "color_card", label: "Tarjetas" },
  { campo: "color_texto", label: "Texto" },
  { campo: "color_dorado", label: "Nombres" },
];

export default function Ajustes({
  evento,
  onGuardado,
}: {
  evento: Evento;
  onGuardado: (e: Evento) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(evento);
  const [estado, setEstado] = useState("");
  const [subiendo, setSubiendo] = useState("");

  const urlPublica =
    typeof window !== "undefined"
      ? `${window.location.origin}/${evento.slug}`
      : `/${evento.slug}`;

  async function guardar(cambios: Partial<Evento>, mensaje = "Guardado") {
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${evento.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    if (!res.ok) {
      setEstado("No pudimos guardar los cambios.");
      return;
    }
    const actualizado: Evento = await res.json();
    setForm(actualizado);
    onGuardado(actualizado);
    setEstado(mensaje);
    if (actualizado.slug !== evento.slug) router.replace(`/admin/${actualizado.slug}`);
  }

  async function subir(file: File, destino: "banner" | "mapa") {
    setSubiendo(destino);
    const datos = new FormData();
    datos.append("file", file);
    const res = await fetch("/api/archivos", { method: "POST", body: datos });
    const data = await res.json();
    setSubiendo("");
    if (!res.ok) {
      setEstado(data.error ?? "No pudimos subir la imagen.");
      return;
    }
    await guardar({ [destino]: data.archivo }, "Imagen actualizada");
  }

  async function eliminar() {
    if (
      !confirm(
        `¿Eliminar el matrimonio de ${evento.nombre1} y ${evento.nombre2}? ` +
          "Se borran sus invitados, mensajes y fotos. Esto no se puede deshacer."
      )
    )
      return;
    const res = await fetch(`/api/eventos/${evento.slug}`, { method: "DELETE" });
    if (res.ok) router.push("/admin");
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-medium">Datos del matrimonio</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">Novia</span>
            <input
              value={form.nombre1}
              onChange={(e) => setForm({ ...form, nombre1: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">Novio</span>
            <input
              value={form.nombre2}
              onChange={(e) => setForm({ ...form, nombre2: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">Fecha (como se muestra)</span>
            <input
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              placeholder="20 · 10 · 2026"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-neutral-500">
            Dirección web (cambiarla invalida los QR ya impresos)
          </span>
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">/</span>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 font-mono"
            />
          </div>
        </label>
        <button
          onClick={() =>
            guardar({
              nombre1: form.nombre1,
              nombre2: form.nombre2,
              fecha: form.fecha,
              slug: form.slug,
            })
          }
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          Guardar datos
        </button>
      </section>

      <section>
        <h2 className="mb-1 font-medium">Colores</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Se aplican al sitio de los invitados al instante.
        </p>
        <div className="flex flex-wrap gap-4">
          {COLORES.map(({ campo, label }) => (
            <label key={campo} className="text-sm">
              <span className="mb-1 block text-neutral-500">{label}</span>
              <input
                type="color"
                value={String(form[campo])}
                onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                onBlur={(e) => guardar({ [campo]: e.target.value }, "Color guardado")}
                className="h-10 w-16 cursor-pointer rounded border border-neutral-300"
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-medium">Banner</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Sin banner propio se usa el marco floral del producto. Se recomienda una
          imagen apaisada (por ejemplo 1440 × 200).
        </p>
        {form.banner && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/archivos/${form.banner}`}
            alt="Banner del matrimonio"
            className="mb-3 w-full max-w-lg rounded-lg border border-neutral-200"
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
            {subiendo === "banner" ? "Subiendo…" : "Subir banner"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subir(f, "banner");
                e.target.value = "";
              }}
            />
          </label>
          {form.banner && (
            <button
              onClick={() => guardar({ banner: "" }, "Volvimos al marco por defecto")}
              className="text-sm text-neutral-500 underline hover:text-neutral-800"
            >
              Usar el marco por defecto
            </button>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.banner_texto === 1}
              onChange={(e) =>
                guardar(
                  { banner_texto: e.target.checked ? 1 : 0 },
                  "Listo"
                )
              }
            />
            Escribir los nombres y la fecha sobre el banner
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-medium">Plano del lugar</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Si no hay plano, la sección Mapa no se le muestra a los invitados.
        </p>
        {form.mapa && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={form.mapa.startsWith("/") ? form.mapa : `/api/archivos/${form.mapa}`}
            alt="Plano del lugar"
            className="mb-3 w-56 rounded-lg border border-neutral-200"
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
            {subiendo === "mapa" ? "Subiendo…" : "Subir plano"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subir(f, "mapa");
                e.target.value = "";
              }}
            />
          </label>
          {form.mapa && (
            <button
              onClick={() => guardar({ mapa: "" }, "Plano quitado")}
              className="text-sm text-neutral-500 underline hover:text-neutral-800"
            >
              Quitar plano
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-medium">QR del matrimonio</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Un solo QR para todos los invitados: lleva a {urlPublica}
        </p>
        <div className="flex flex-wrap items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/eventos/${evento.slug}/qr`}
            alt={`QR de ${evento.nombre1} y ${evento.nombre2}`}
            className="h-40 w-40 rounded-lg border border-neutral-200 bg-white p-2"
          />
          <div className="space-y-2 text-sm">
            <a
              href={`/api/eventos/${evento.slug}/qr?descargar=1`}
              download
              className="block rounded-lg border border-neutral-300 px-4 py-2 text-center hover:bg-neutral-50"
            >
              Descargar PNG
            </a>
            <a
              href={`/api/eventos/${evento.slug}/qr?formato=svg&descargar=1`}
              download
              className="block rounded-lg border border-neutral-300 px-4 py-2 text-center hover:bg-neutral-50"
            >
              Descargar SVG (para imprenta)
            </a>
            <button
              onClick={() => navigator.clipboard?.writeText(urlPublica)}
              className="block w-full rounded-lg border border-neutral-300 px-4 py-2 hover:bg-neutral-50"
            >
              Copiar dirección
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <h2 className="mb-1 font-medium text-rose-900">Eliminar matrimonio</h2>
        <p className="mb-3 text-sm text-rose-800">
          Borra el matrimonio junto con sus invitados, mensajes y fotos.
        </p>
        <button
          onClick={eliminar}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700"
        >
          Eliminar
        </button>
      </section>

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}
    </div>
  );
}
