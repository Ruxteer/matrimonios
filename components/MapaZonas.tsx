import { IconoZona } from "./IconosMapa";

// Punto de una zona sobre el plano. Toma el color de los botones del evento
// (--rosa) y late despacio para que se note que se puede tocar. Mide en
// proporción al plano que lo contiene (que es un @container): así tapa la
// misma porción del plano a cualquier tamaño y no se come los nombres
// impresos en él. Fuera de un contenedor, cqw cae al ancho de la pantalla.
const TAMANO = "size-[clamp(20px,3.8cqw,34px)]";

export function PuntoZona({ icono, elegido = false }: { icono: string; elegido?: boolean }) {
  return (
    <span className={`relative grid place-items-center ${TAMANO}`}>
      <span className="zona-pulso absolute inset-0 rounded-full bg-rosa" aria-hidden="true" />
      <span
        className={`zona-punto relative grid size-full place-items-center rounded-full bg-rosa text-rosa-texto shadow-[0_1px_4px_rgb(0_0_0/0.4)] ring-2 ${
          elegido ? "scale-125 ring-black" : "ring-white"
        }`}
      >
        <IconoZona icono={icono} className="size-[58%]" grosor={2.25} />
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
