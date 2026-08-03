"use client";

import { useState } from "react";
import { BotonRosa } from "./ui";

const MAX = 300;

export default function FormularioMensaje({ slug }: { slug: string }) {
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/eventos/${slug}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, mensaje }),
    });
    if (res.ok) setEnviado(true);
    else setError("No pudimos enviar tu mensaje. Intenta de nuevo.");
  }

  if (enviado) {
    return (
      <div className="mx-auto w-full max-w-[259px] rounded-[20px] bg-gris-card px-6 py-10 text-center shadow-sm">
        <p className="mb-2 font-serif text-2xl font-bold">¡Gracias!</p>
        <p className="text-sm opacity-70">Tu mensaje quedó guardado con mucho cariño.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="mx-auto w-full max-w-[259px] rounded-[20px] bg-gris-card px-[15px] py-4 shadow-sm"
    >
      <p className="mb-3 pl-1 font-serif text-sm font-bold leading-snug">
        Tu mensaje será leído con
        <br /> mucho cariño
      </p>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Tu nombre"
        required
        className="mb-2 w-full rounded-[9px] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-neutral-400"
      />
      <div className="relative mb-3">
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value.slice(0, MAX))}
          placeholder="Escribe aquí tus buenos deseos para los novios..."
          required
          rows={6}
          className="w-full resize-none rounded-[9px] bg-white px-3 py-2 pb-6 text-[13px] outline-none placeholder:text-neutral-400"
        />
        <span className="absolute bottom-2.5 right-3 text-[11px] opacity-50">
          {mensaje.length}/{MAX}
        </span>
      </div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <BotonRosa type="submit">Enviar mensaje</BotonRosa>
    </form>
  );
}
