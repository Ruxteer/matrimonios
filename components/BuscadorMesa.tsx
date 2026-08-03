"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonRosa } from "./ui";
import { IconCopas } from "./Icons";

export default function BuscadorMesa({
  slug,
  boton = "Buscar",
  inicial = "",
}: {
  slug: string;
  boton?: string;
  inicial?: string;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(inicial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (nombre.trim())
          router.push(`/${slug}/mesa?q=${encodeURIComponent(nombre.trim())}`);
      }}
      className="mx-auto w-full max-w-[259px] rounded-[20px] bg-gris-card px-[15px] py-[18px] shadow-sm"
    >
      <div className="mb-3 flex items-center gap-3 pl-2.5">
        <IconCopas className="h-[34px] w-auto shrink-0" />
        <p className="font-serif text-base font-bold">Busca tu mesa</p>
      </div>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Ingresa tu nombre y apellido"
        className="mb-1.5 w-full rounded-[9px] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-neutral-400"
      />
      <BotonRosa type="submit">{boton}</BotonRosa>
    </form>
  );
}
