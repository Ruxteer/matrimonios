"use client";

import { useState } from "react";

export default function Login({ onOk }: { onOk: () => void }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pass }),
    });
    if (res.ok) {
      setPass("");
      onOk();
    } else {
      setError("Contraseña incorrecta.");
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6 pt-24">
      <h1 className="mb-1 text-2xl font-semibold">Panel de matrimonios</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Ingresa la contraseña de administración para continuar.
      </p>
      <form onSubmit={entrar} className="space-y-3">
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Contraseña"
          autoFocus
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
