"use client";

import { useState } from "react";
import { Bienvenida, MarcoVenito } from "./Marca";

// La entrada al panel lleva la misma portada de la marca que la lista de
// clientes: es lo primero que se ve al abrir venito.cl.
export default function Login({ onOk, slug }: { onOk: () => void; slug?: string }) {
  const [pass, setPass] = useState("");
  const [verla, setVerla] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pass, slug }),
    });
    setEnviando(false);
    if (!res.ok) {
      setError("Esa contraseña no es la correcta.");
      return;
    }
    setPass("");
    onOk();
  }

  return (
    <MarcoVenito>
      <main className="mx-auto w-full max-w-[986px] px-6 pt-16 md:pt-[180px]">
        <Bienvenida />

        <form onSubmit={entrar} className="mt-12 w-full max-w-[440px] md:mt-[72px]">
          <label htmlFor="clave-panel" className="block text-[18px] font-bold md:text-[22px]">
            Entrar al panel
          </label>
          <p className="mt-1 text-[15px] text-neutral-500">
            {slug
              ? "La clave de este evento, o la de administración."
              : "La contraseña de administración."}
          </p>

          <div className="mt-4 flex items-center rounded-full border-[3px] border-venito pl-5 pr-2 focus-within:border-black">
            <input
              id="clave-panel"
              type={verla ? "text" : "password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-transparent py-3 text-[18px] outline-none placeholder:text-neutral-300"
            />
            <button
              type="button"
              onClick={() => setVerla((v) => !v)}
              aria-pressed={verla}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm text-venito-gris hover:text-black"
            >
              {verla ? "Ocultar" : "Ver"}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || pass.length === 0}
            className="mt-5 rounded-full bg-venito px-8 py-3 text-[18px] font-bold transition hover:brightness-95 disabled:opacity-40"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </main>
    </MarcoVenito>
  );
}
