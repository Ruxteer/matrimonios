"use client";

/* eslint-disable @next/next/no-img-element -- vista previa de un logo recién elegido */
import { useEffect, useRef, useState } from "react";
import type { Cliente } from "@/lib/db";
import { LogoCliente } from "./Marca";

const COLOR_INICIAL = "#5326b4";

async function subirLogo(file: File): Promise<string> {
  const datos = new FormData();
  datos.append("file", file);
  const res = await fetch("/api/archivos", { method: "POST", body: datos });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pudimos subir el logo.");
  return data.archivo;
}

/**
 * Crear o editar un cliente: nombre, color de su tarjeta y logo. El logo se
 * sube recién al guardar, para no dejar archivos sueltos si se cancela.
 */
export default function FormCliente({
  cliente,
  onListo,
  onCancelar,
  onEliminado,
}: {
  cliente?: Cliente;
  onListo: (c: Cliente) => void;
  onCancelar: () => void;
  onEliminado?: () => void;
}) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [color, setColor] = useState(cliente?.color ?? COLOR_INICIAL);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [vista, setVista] = useState("");
  const vistaActual = useRef("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Vista previa del logo elegido: la URL temporal se libera al cambiarlo o al salir.
  function elegirLogo(file: File | null) {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    vistaActual.current = file ? URL.createObjectURL(file) : "";
    setVista(vistaActual.current);
    setArchivo(file);
  }
  useEffect(() => () => {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      let actual = cliente;
      if (!actual) {
        const res = await fetch("/api/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, color }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No pudimos crear el cliente.");
        actual = data as Cliente;
      }
      const cambios: Record<string, string> = {};
      if (cliente) Object.assign(cambios, { nombre, color });
      if (archivo) cambios.logo = await subirLogo(archivo);
      else if (quitarLogo) cambios.logo = "";
      if (Object.keys(cambios).length) {
        const res = await fetch(`/api/clientes/${actual.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cambios),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No pudimos guardar el cliente.");
        actual = data as Cliente;
      }
      onListo(actual);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar el cliente.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!cliente) return;
    if (
      !confirm(
        `¿Eliminar a ${cliente.nombre}? Sus eventos no se borran: pasan a Venito.`
      )
    )
      return;
    const res = await fetch(`/api/clientes/${cliente.slug}`, { method: "DELETE" });
    if (res.ok) onEliminado?.();
    else setError("No pudimos eliminar el cliente.");
  }

  const logoActual = quitarLogo ? "" : cliente?.logo ?? "";

  return (
    <form
      onSubmit={guardar}
      className="mt-8 w-full max-w-[673px] rounded-[38px] border-[3px] border-venito p-6 md:p-8"
    >
      <p className="mb-5 text-[22px] font-bold">{cliente ? "Editar cliente" : "Nuevo cliente"}</p>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div
          className="flex size-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[28px]"
          style={{ background: color }}
        >
          {vista ? (
            <img src={vista} alt="" className="max-h-[104px] max-w-[104px] object-contain" />
          ) : (
            <LogoCliente
              cliente={{ id: -1, nombre: nombre || "Cliente", color, logo: logoActual }}
              className="size-[104px]"
            />
          )}
        </div>
        <div className="flex-1 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Nombre</span>
            <input
              required
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Creative WIIN"
              maxLength={80}
              className="w-full rounded-2xl border-2 border-neutral-200 px-4 py-2.5 outline-none focus:border-venito"
            />
          </label>
          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Color de la tarjeta</span>
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-xl border-2 border-neutral-200 bg-white p-1"
                />
                <span className="font-mono text-sm text-neutral-500">{color}</span>
              </span>
            </label>
            <div>
              <span className="mb-1 block text-sm font-bold">Logo</span>
              <span className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-full border-2 border-neutral-200 px-4 py-2 text-sm hover:border-venito">
                  {archivo ? "Cambiar" : logoActual ? "Reemplazar" : "Subir logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        elegirLogo(f);
                        setQuitarLogo(false);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {(archivo || logoActual) && (
                  <button
                    type="button"
                    onClick={() => {
                      elegirLogo(null);
                      setQuitarLogo(Boolean(cliente?.logo));
                    }}
                    className="text-sm text-neutral-500 underline hover:text-black"
                  >
                    Quitar
                  </button>
                )}
              </span>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            PNG con fondo transparente o un logo cuadrado. Se ve sobre el color de la tarjeta.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={guardando || !nombre.trim()}
          className="rounded-full bg-venito px-6 py-2.5 font-bold text-black transition hover:brightness-95 disabled:opacity-40"
        >
          {guardando ? "Guardando…" : cliente ? "Guardar" : "Crear cliente"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full border-2 border-neutral-200 px-6 py-2 hover:border-neutral-400"
        >
          Cancelar
        </button>
        {cliente && onEliminado && (
          <button
            type="button"
            onClick={eliminar}
            className="ml-auto text-sm text-rose-600 underline hover:text-rose-800"
          >
            Eliminar cliente
          </button>
        )}
      </div>
    </form>
  );
}
