"use client";

import { useState } from "react";
import { PRODUCTO } from "@/lib/config";

export default function Login({ onOk }: { onOk: () => void }) {
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
      body: JSON.stringify({ password: pass }),
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
    <main className="grid min-h-dvh bg-white text-neutral-900 md:grid-cols-2">
      {/* La presentación sobra en un celular: solo aparece en pantallas anchas. */}
      <div className="hidden flex-col justify-between bg-neutral-950 p-12 text-white md:flex">
        <p className="text-xs uppercase tracking-[0.35em] text-white/50">{PRODUCTO.nombre}</p>
        <div>
          <p className="font-script text-6xl leading-[1.05]">
            Cada matrimonio,
            <br />
            su propia web
          </p>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/50">
            Invitados, mesas, mensajes, fotos, el QR y la pantalla del salón, en un solo
            lugar.
          </p>
        </div>
        <p className="text-xs text-white/40">Panel de administración</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={entrar} className="w-full max-w-sm">
          <h1 className="font-serif text-3xl">Entrar al panel</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Es la misma contraseña para todos los matrimonios.
          </p>

          <label className="mt-10 block">
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Contraseña
            </span>
            <div className="mt-2 flex items-center border-b border-neutral-300 focus-within:border-neutral-900">
              <input
                type={verla ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoFocus
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent py-2 outline-none placeholder:text-neutral-300"
              />
              <button
                type="button"
                onClick={() => setVerla((v) => !v)}
                className="shrink-0 px-2 text-xs uppercase tracking-widest text-neutral-400 hover:text-neutral-900"
              >
                {verla ? "Ocultar" : "Ver"}
              </button>
            </div>
          </label>

          {error && (
            <p role="alert" className="mt-4 border-l-2 border-neutral-900 pl-3 text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || pass.length === 0}
            className="mt-8 w-full bg-neutral-900 py-3 text-sm uppercase tracking-[0.2em] text-white transition hover:bg-neutral-700 disabled:opacity-30"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
