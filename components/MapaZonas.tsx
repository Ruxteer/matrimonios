import { IconoZona } from "./IconosMapa";

// Punto de una zona sobre el plano. Toma el color de los botones del evento
// (--rosa) y late despacio para que se note que se puede tocar.
export function PuntoZona({ icono, elegido = false }: { icono: string; elegido?: boolean }) {
  return (
    <span className="relative grid size-8 place-items-center">
      <span className="zona-pulso absolute inset-0 rounded-full bg-rosa" aria-hidden="true" />
      <span
        className={`relative grid size-8 place-items-center rounded-full bg-rosa text-rosa-texto shadow-[0_2px_6px_rgb(0_0_0/0.35)] ring-2 transition ${
          elegido ? "scale-125 ring-black" : "ring-white"
        }`}
      >
        <IconoZona icono={icono} className="size-4" grosor={2.25} />
      </span>
    </span>
  );
}

/** Ícono sobre un cuadrado del color del evento, como en la leyenda y la ficha. */
export function CuadroIcono({
  icono,
  className = "size-7 rounded-md",
  iconoClassName = "size-4",
}: {
  icono: string;
  className?: string;
  iconoClassName?: string;
}) {
  return (
    <span className={`grid shrink-0 place-items-center bg-rosa text-rosa-texto ${className}`}>
      <IconoZona icono={icono} className={iconoClassName} />
    </span>
  );
}
