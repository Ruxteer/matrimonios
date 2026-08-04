"use client";

import { useCallback, useEffect, useState } from "react";
import type { Actividad } from "@/lib/db";

export default function Agenda({ slug }: { slug: string }) {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState("");

  const cargar = useCallback(() => {
    fetch(`/api/eventos/${slug}/agenda`).then(async (res) => {
      if (res.ok) setActividades(await res.json());
      setCargando(false);
    });
  }, [slug]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function patch(id: number, cambios: Partial<Actividad>) {
    return fetch(`/api/eventos/${slug}/agenda/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
  }

  async function guardar(id: number, cambios: Partial<Actividad>) {
    setEstado("Guardando…");
    const res = await patch(id, cambios);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setEstado(data?.error ?? "No pudimos guardar el cambio.");
      return;
    }
    const actualizada: Actividad = await res.json();
    setActividades((as) => as.map((a) => (a.id === id ? actualizada : a)));
    setEstado("Guardado");
  }

  // Reordenar es intercambiar el `orden` de las dos vecinas. La lista se pinta
  // al tiro porque mover una actividad tiene que sentirse inmediato.
  async function mover(indice: number, direccion: -1 | 1) {
    const actual = actividades[indice];
    const vecina = actividades[indice + direccion];
    if (!vecina) return;
    const lista = [...actividades];
    lista[indice] = { ...vecina, orden: actual.orden };
    lista[indice + direccion] = { ...actual, orden: vecina.orden };
    setActividades(lista);
    setEstado("Guardando…");
    const res = await Promise.all([
      patch(actual.id, { orden: vecina.orden }),
      patch(vecina.id, { orden: actual.orden }),
    ]);
    if (res.every((r) => r.ok)) {
      setEstado("Orden guardado");
      return;
    }
    setEstado("No pudimos guardar el orden.");
    cargar();
  }

  async function agregar() {
    const titulo = prompt("¿Qué actividad? (por ejemplo: Ceremonia)");
    if (!titulo?.trim()) return;
    const res = await fetch(`/api/eventos/${slug}/agenda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Hereda el día de la última: en un matrimonio de varios días lo normal es
      // ir cargando la programación de un día antes de pasar al siguiente.
      body: JSON.stringify({ titulo, dia: actividades.at(-1)?.dia ?? "" }),
    });
    if (!res.ok) {
      setEstado("No pudimos agregar la actividad.");
      return;
    }
    const nueva: Actividad = await res.json();
    setActividades((as) => [...as, nueva]);
    setEstado("");
  }

  async function eliminar(actividad: Actividad) {
    if (!confirm(`¿Eliminar "${actividad.titulo}" del programa?`)) return;
    const res = await fetch(`/api/eventos/${slug}/agenda/${actividad.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setEstado("No pudimos eliminar la actividad.");
      return;
    }
    setActividades((as) => as.filter((a) => a.id !== actividad.id));
    setEstado("Actividad eliminada");
  }

  if (cargando) return <p className="text-neutral-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={agregar}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          + Agregar actividad
        </button>
        <span className="text-sm text-neutral-500">
          {actividades.length} actividades · cada campo se guarda solo al salir de él
        </span>
      </div>

      {actividades.length === 0 && (
        <p className="text-neutral-400">
          Todavía no hay actividades: los invitados ven la agenda vacía.
        </p>
      )}

      {actividades.map((actividad, i) => (
        <div key={actividad.id} className="rounded-lg border border-neutral-300 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Campo
              etiqueta="Hora"
              valor={actividad.hora}
              placeholder="19:00"
              className="w-24"
              onGuardar={(hora) => guardar(actividad.id, { hora })}
            />
            <Campo
              etiqueta="Actividad"
              valor={actividad.titulo}
              placeholder="Ceremonia"
              className="min-w-52 flex-1"
              onGuardar={(titulo) => guardar(actividad.id, { titulo })}
            />
            <div className="ml-auto flex gap-1 pb-1">
              <BotonIcono
                titulo="Subir"
                onClick={() => mover(i, -1)}
                disabled={i === 0}
              >
                ↑
              </BotonIcono>
              <BotonIcono
                titulo="Bajar"
                onClick={() => mover(i, 1)}
                disabled={i === actividades.length - 1}
              >
                ↓
              </BotonIcono>
              <BotonIcono
                titulo="Eliminar"
                onClick={() => eliminar(actividad)}
                className="hover:border-rose-300 hover:text-rose-600"
              >
                ✕
              </BotonIcono>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Lugar"
              valor={actividad.lugar}
              placeholder="Jardín principal"
              onGuardar={(lugar) => guardar(actividad.id, { lugar })}
            />
            <Campo
              etiqueta="Día (solo si la celebración dura más de uno)"
              valor={actividad.dia}
              placeholder="Sábado 20"
              onGuardar={(dia) => guardar(actividad.id, { dia })}
            />
          </div>

          <div className="mt-3">
            <Campo
              etiqueta="Descripción"
              valor={actividad.descripcion}
              placeholder="Lo que el invitado necesita saber de este momento."
              textarea
              onGuardar={(descripcion) => guardar(actividad.id, { descripcion })}
            />
          </div>
        </div>
      ))}

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}
    </div>
  );
}

function BotonIcono({
  children,
  titulo,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  titulo: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      aria-label={titulo}
      className={`rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50 disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  );
}

// Se guarda al salir del campo, igual que los colores de Ajustes y las celdas
// de la tabla de invitados: el organizador corrige un dato suelto (una hora que
// se movió) y no tiene que buscar ningún botón.
function Campo({
  etiqueta,
  valor,
  placeholder,
  textarea,
  className = "",
  onGuardar,
}: {
  etiqueta: string;
  valor: string;
  placeholder?: string;
  textarea?: boolean;
  className?: string;
  onGuardar: (valor: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const [previo, setPrevio] = useState(valor);

  // Si el valor guardado cambia por fuera (al recargar la agenda), el borrador
  // se pone al día.
  if (previo !== valor) {
    setPrevio(valor);
    setTexto(valor);
  }

  function confirmar() {
    if (texto.trim() !== valor) onGuardar(texto.trim());
  }

  const estilo = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-neutral-500">{etiqueta}</span>
      {textarea ? (
        <textarea
          rows={2}
          value={texto}
          placeholder={placeholder}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmar}
          className={estilo}
        />
      ) : (
        <input
          value={texto}
          placeholder={placeholder}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmar}
          className={estilo}
        />
      )}
    </label>
  );
}
