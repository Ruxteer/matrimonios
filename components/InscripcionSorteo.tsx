"use client";

import { useState } from "react";
import { BotonRosa } from "./ui";

const CAMPO =
  "mb-2 w-full rounded-[9px] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-neutral-400";

// Inscripción a un sorteo desde el QR de la pantalla: nombre y correo, y listo.
export default function InscripcionSorteo({ slug, id }: { slug: string; id: number }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<"" | "nuevo" | "repetido">("");
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const res = await fetch(`/api/eventos/${slug}/sorteos/${id}/inscribir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email }),
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) {
        setError(datos?.error ?? "No pudimos inscribirte. Intenta de nuevo.");
        return;
      }
      setListo(datos?.repetido ? "repetido" : "nuevo");
    } catch {
      setError("Sin conexión. Revisa tu internet e intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div role="status" className="rounded-[10px] bg-white px-4 py-7 text-center">
        <p className="font-serif text-xl font-bold">¡Ya estás participando!</p>
        <p className="mt-2 text-[12px] opacity-70">
          {listo === "repetido"
            ? "Ese correo ya estaba inscrito: tienes una oportunidad, como todos."
            : "Mira la pantalla: ahí sale el ganador."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar}>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Tu nombre y apellido"
        aria-label="Tu nombre y apellido"
        autoComplete="name"
        required
        minLength={2}
        maxLength={120}
        className={CAMPO}
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Tu correo"
        aria-label="Tu correo"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        maxLength={200}
        className={CAMPO}
      />
      {error && (
        <p role="alert" className="mb-2 text-[12px] text-rose-600">
          {error}
        </p>
      )}
      <BotonRosa type="submit" disabled={enviando} className="mt-1">
        {enviando ? "Inscribiendo…" : "Participar"}
      </BotonRosa>
      <p className="mt-2 text-center text-[10px] opacity-60">
        Usamos tu correo solo para este sorteo. Una inscripción por persona.
      </p>
    </form>
  );
}
