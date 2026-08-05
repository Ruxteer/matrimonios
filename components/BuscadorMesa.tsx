"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);
  // Lo último que se pidió: así se descartan las respuestas de teclas
  // anteriores, que en un celular lento llegan desordenadas.
  const ultima = useRef("");

  const buscado = nombre.trim();

  useEffect(() => {
    if (buscado.length < 2) return;
    // Se espera a que deje de escribir para no pedir una vez por letra.
    const espera = setTimeout(async () => {
      ultima.current = buscado;
      try {
        const res = await fetch(
          `/api/eventos/${slug}/mesa?sugerencias=1&q=${encodeURIComponent(buscado)}`
        );
        if (!res.ok || ultima.current !== buscado) return;
        const datos = await res.json();
        setSugerencias(datos.sugerencias ?? []);
      } catch {
        setSugerencias([]);
      }
    }, 200);
    return () => clearTimeout(espera);
  }, [buscado, slug]);

  function ver(elegido: string) {
    setAbierto(false);
    router.push(`/${slug}/mesa?q=${encodeURIComponent(elegido)}`);
  }

  // Con menos de dos letras no se sugiere nada, y si lo escrito ya es
  // exactamente un nombre de la lista, la lista sobra.
  const lista =
    abierto && buscado.length >= 2 ? sugerencias.filter((s) => s !== buscado) : [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (buscado) ver(buscado);
      }}
      className="mx-auto w-full max-w-[259px] rounded-[20px] bg-gris-card px-[15px] py-[18px] shadow-sm"
    >
      <div className="mb-3 flex items-center gap-3 pl-2.5">
        <IconCopas className="h-[34px] w-auto shrink-0" />
        <p className="font-serif text-base font-bold">Busca tu mesa</p>
      </div>

      <div className="relative mb-1.5">
        <input
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          // El toque sobre una sugerencia tiene que alcanzar a registrarse
          // antes de que el desplegable se cierre por perder el foco.
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder="Ingresa tu nombre y apellido"
          autoComplete="off"
          className="w-full rounded-[9px] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-neutral-400"
        />
        {lista.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-[9px] bg-white text-left shadow-lg">
            {lista.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ver(s)}
                  // py-3 deja cada opción en 44px: lo mínimo para acertarle
                  // con el dedo sin tocar la de al lado.
                  className="block w-full px-3 py-3 text-left text-[13px] hover:bg-rosa-suave"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BotonRosa type="submit">{boton}</BotonRosa>
    </form>
  );
}
