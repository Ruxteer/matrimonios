/* eslint-disable @next/next/no-img-element -- logos SVG y la mascota: tamaños fijos del diseño */
import Link from "next/link";
import type { Cliente } from "@/lib/db";
import { urlArchivo } from "@/lib/urls";
import { textoSobre } from "@/lib/colores";

// Piezas de la marca Venito para la portada y el panel (Figma "quick-wins"):
// fondo blanco, Rethink Sans, naranjo #FFA100 y la mascota de Ruxteer al pie.

export function MarcoVenito({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white font-marca text-black">
      {children}
      <PieVenito />
    </div>
  );
}

export function PieVenito() {
  return (
    <footer className="mt-auto flex items-end justify-center gap-1 px-4 pt-16">
      <p className="mb-[29px] text-[10px] font-bold leading-[1.4]">
        © {new Date().getFullYear()} — Venito by Ruxteer
      </p>
      {/* La mascota asoma desde el borde inferior: se ve solo su parte de arriba. */}
      <div className="h-[68px] w-[75px] shrink-0 overflow-hidden" aria-hidden="true">
        <img
          src="/brand/mascota-ruxteer.webp"
          alt=""
          width={75}
          height={122}
          className="block h-auto w-[75px] max-w-none"
        />
      </div>
    </footer>
  );
}

/** "Bienvenido a [Venito]" con el logo naranjo, como en la portada del diseño. */
export function Bienvenida() {
  return (
    <>
      <h1 className="flex flex-wrap items-end gap-x-[5px] text-[28px] font-bold leading-[1.3] md:text-[35px]">
        <span>Bienvenido a</span>
        <img
          src="/brand/venito-naranjo.svg"
          alt="Venito"
          className="mb-[6px] h-[31.4px] w-[105px] md:mb-2 md:h-[39.25px] md:w-[131.226px]"
        />
      </h1>
      <div className="mt-[9px] text-[18px] leading-[1.32] md:text-[22px]">
        <p>Tu evento en un solo lugar.</p>
        <p className="font-bold">Participa, comparte y guarda tus mejores momentos.</p>
      </div>
    </>
  );
}

/** Logo del cliente; sin logo subido, su nombre sobre su color. */
export function LogoCliente({
  cliente,
  className,
  grande = false,
}: {
  cliente: Pick<Cliente, "id" | "nombre" | "color" | "logo">;
  className: string;
  grande?: boolean;
}) {
  if (cliente.id === 0) {
    return (
      <span className={`flex items-center justify-center ${className}`}>
        <img src="/brand/venito-negro-tarjeta.svg" alt="Venito" className="h-[28.415px] w-[95px]" />
      </span>
    );
  }
  if (cliente.logo) {
    return (
      <span className={`flex items-center justify-center ${className}`}>
        <img
          src={urlArchivo(cliente.logo)}
          alt={cliente.nombre}
          className="max-h-full max-w-full object-contain"
        />
      </span>
    );
  }
  return (
    <span
      className={`flex items-center justify-center px-2 text-center font-bold leading-tight ${grande ? "text-[22px]" : "text-sm"} ${className}`}
      style={{ background: cliente.color, color: textoSobre(cliente.color) }}
    >
      {cliente.nombre}
    </span>
  );
}

/** Tarjeta cuadrada de un cliente en la portada del panel. */
export function TarjetaCliente({ cliente }: { cliente: Cliente & { eventos?: number } }) {
  const eventos = cliente.eventos ?? 0;
  return (
    <Link
      href={`/admin/clientes/${cliente.slug}`}
      title={`${cliente.nombre} · ${eventos} ${eventos === 1 ? "evento" : "eventos"}`}
      className="flex size-[160px] items-center justify-center overflow-hidden rounded-[38px] transition hover:brightness-95 focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-black"
      style={{ background: cliente.color }}
    >
      <LogoCliente cliente={cliente} grande className="size-[140px]" />
      <span className="sr-only">
        {eventos} {eventos === 1 ? "evento" : "eventos"}
      </span>
    </Link>
  );
}
