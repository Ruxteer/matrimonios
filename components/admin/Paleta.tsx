"use client";

import { useState } from "react";
import { etiquetaEvento } from "@/lib/identidad";
import type { EventoPanel } from "@/lib/eventos";
import { coloresPorTipo, paletaEvento, PALETAS, PALETAS_ACTIVACION, type Paleta as ColoresPaleta } from "@/lib/config";
import { aclarar, colorValido, oscurecer, textoSobre } from "@/lib/colores";

const CAMPOS = [
  { campo: "color_fondo", clave: "fondo", label: "Fondo" },
  { campo: "color_rosa", clave: "rosa", label: "Botones" },
  { campo: "color_card", clave: "card", label: "Tarjetas" },
  { campo: "color_texto", clave: "texto", label: "Texto" },
  { campo: "color_dorado", clave: "dorado", label: "Acento" },
] as const;

type Campo = (typeof CAMPOS)[number]["campo"];

export default function Paleta({
  evento,
  onGuardado,
}: {
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
}) {
  const activacion = evento.tipo === "activacion";
  const defaults = coloresPorTipo(evento.tipo);
  const paletas = activacion ? PALETAS_ACTIVACION : PALETAS;
  const [form, setForm] = useState<Record<Campo, string>>(() => {
    const efectiva = paletaEvento(evento);
    return { color_fondo: efectiva.fondo, color_rosa: efectiva.rosa, color_card: efectiva.card, color_texto: efectiva.texto, color_dorado: efectiva.dorado };
  });
  const [estado, setEstado] = useState("");

  async function guardar(cambios: Partial<Record<Campo, string>>) {
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${evento.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ...cambios }),
    });
    if (!res.ok) {
      setEstado("No pudimos guardar los colores.");
      return;
    }
    onGuardado(await res.json());
    setEstado("Colores guardados");
  }

  function aplicar(colores: ColoresPaleta) {
    const cambios = {
      color_fondo: colores.fondo,
      color_rosa: colores.rosa,
      color_card: colores.card,
      color_texto: colores.texto,
      color_dorado: colores.dorado,
    };
    setForm(cambios);
    guardar(cambios);
  }

  // Los tonos derivados se calculan igual que en el sitio del invitado, para
  // que la vista previa muestre exactamente lo que va a ver la gente.
  const boton = colorValido(form.color_rosa) ? form.color_rosa : defaults.rosa;
  const elegida = paletas.find((p) =>
    CAMPOS.every(({ campo, clave }) => p.colores[clave] === form[campo])
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 font-medium">Paleta de colores</h2>
        <p className="text-sm text-neutral-500">
          Se aplican al sitio de los participantes al instante. El resto de los tonos (el
          botón presionado, el pie de página) se calculan solos a partir de estos cinco.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm text-neutral-500">Paletas listas</p>
        <div className="flex flex-wrap gap-2">
          {paletas.map((p) => (
            <button
              key={p.nombre}
              onClick={() => aplicar(p.colores)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50 ${
                elegida?.nombre === p.nombre
                  ? "border-neutral-900 ring-1 ring-neutral-900"
                  : "border-neutral-300"
              }`}
            >
              <span className="flex overflow-hidden rounded-full border border-neutral-200">
                {[p.colores.fondo, p.colores.card, p.colores.rosa, p.colores.dorado].map(
                  (c) => (
                    <span key={c} className="h-4 w-4" style={{ background: c }} />
                  )
                )}
              </span>
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-wrap gap-4">
          {CAMPOS.map(({ campo, label }) => (
            <label key={campo} className="text-sm">
              <span className="mb-1 block text-neutral-500">{label}</span>
              <input
                type="color"
                value={form[campo]}
                onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                onBlur={(e) => guardar({ [campo]: e.target.value })}
                className="h-10 w-16 cursor-pointer rounded border border-neutral-300"
              />
              <input
                value={form[campo]}
                onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                onBlur={(e) =>
                  colorValido(e.target.value)
                    ? guardar({ [campo]: e.target.value })
                    : setForm({ ...form, [campo]: paletaEvento(evento)[CAMPOS.find((item) => item.campo === campo)!.clave] })
                }
                aria-label={`Código del color ${label}`}
                className="mt-1 block w-16 rounded border border-neutral-300 px-1 py-0.5 text-center font-mono text-xs uppercase"
              />
            </label>
          ))}
        </div>

        {/* Vista previa: lo mismo que ve el invitado, en chico. */}
        <div
          className={`w-[220px] shrink-0 rounded-2xl border border-neutral-200 p-4 text-center ${activacion ? "font-sans" : ""}`}
          style={{ background: form.color_fondo, color: form.color_texto }}
        >
          <p
            className={activacion ? "text-2xl font-extrabold leading-tight" : "font-script text-3xl leading-none"}
            style={{ color: activacion ? form.color_texto : form.color_dorado }}
          >
            {etiquetaEvento(evento)}
          </p>
          <p className={`mb-3 mt-1 text-[11px] font-bold ${activacion ? "font-sans" : "font-serif"}`}>
            Así se ve el sitio
          </p>
          <div
            className="rounded-[20px] p-3 shadow-sm"
            style={{ background: form.color_card }}
          >
            <p className={`mb-2 text-[11px] font-bold leading-snug ${activacion ? "font-sans" : "font-serif"}`}>
              {evento.tipo === "activacion" ? "Regístrate y comparte tu experiencia" : "Deja tus buenos deseos para los novios"}
            </p>
            <span
              className={`block py-1.5 text-[11px] font-bold shadow-sm ${activacion ? "rounded-full" : "rounded-[9px]"}`}
              style={{ background: boton, color: textoSobre(boton) }}
            >
              {evento.tipo === "activacion" ? "Registrarme" : "Enviar mensaje"}
            </span>
            <span
              className={`mt-2 block py-1.5 text-[11px] font-bold shadow-sm ${activacion ? "rounded-full" : "rounded-[9px]"}`}
              style={{ background: oscurecer(boton, 0.12), color: textoSobre(boton) }}
            >
              Presionado
            </span>
          </div>
          <div
            className="mt-3 rounded-lg py-2 text-[10px]"
            style={{ background: aclarar(boton, 0.72) }}
          >
            {activacion ? "Una experiencia con Venito" : "Disfruta cada momento"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => aplicar(defaults)}
          className="text-sm text-neutral-500 underline hover:text-neutral-800"
        >
          Volver a los colores originales
        </button>
        {estado && <span className="text-sm text-neutral-500">{estado}</span>}
      </div>
    </div>
  );
}
