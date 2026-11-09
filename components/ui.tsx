import Link from "next/link";
import type { Evento } from "@/lib/db";
import { modulosActivos, type ModuloId } from "@/lib/modulos";
import { textosModulo } from "@/lib/textos";
import { IconoModulo, IconPalomas } from "./Icons";

export function BotonRosa({
  children,
  href,
  onClick,
  type,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base = `block w-full rounded-[9px] bg-rosa py-2 text-center text-[13px] font-bold text-rosa-texto shadow-sm transition hover:brightness-95 disabled:opacity-50 ${className}`;
  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={base}>
      {children}
    </button>
  );
}

// Contenedor de todo lo que va dentro del sitio del invitado: el ancho de 259px
// viene del diseño y es lo que hace que todas las pantallas se vean iguales.
export function Tarjeta({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[259px] rounded-[20px] bg-gris-card p-[15px] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 text-center font-serif text-lg font-bold whitespace-pre-line">
      {children}
    </h2>
  );
}

// Tarjeta de acción del inicio: ícono a la izquierda, texto y botón.
export function TarjetaAccion({
  icon,
  texto,
  boton,
  href,
}: {
  icon: React.ReactNode;
  texto: React.ReactNode;
  boton: string;
  /** Sin href es solo una muestra (la vista previa del panel). */
  href?: string;
}) {
  return (
    <Tarjeta>
      <div className="mb-3 flex items-center gap-4 pl-3 pr-1">
        <span className="shrink-0">{icon}</span>
        <p className="whitespace-pre-line font-serif text-xs font-bold leading-snug">
          {texto}
        </p>
      </div>
      <BotonRosa href={href}>{boton}</BotonRosa>
    </Tarjeta>
  );
}

// Atajos cuadrados al pie de cada módulo: lleva a los demás módulos encendidos.
export function Atajos({ evento, omitir }: { evento: Evento; omitir: ModuloId }) {
  const items = modulosActivos(evento).filter((m) => m.id !== omitir);
  if (!items.length) return null;

  if (evento.tipo === "activacion") {
    return (
      <nav className="activation-shortcuts" aria-label="Más opciones del evento">
        {items.map((m) => (
          <Link key={m.id} href={`/${evento.slug}/${m.ruta}`}>
            <IconoModulo id={m.id} className="h-4 w-4" />
            <span>{textosModulo(evento, m.id).boton}</span><span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
    );
  }

  // Medidas del frame "foto" del Figma "creative-wiin": tarjetas de 137 px con
  // botón alto, para que el dedo no tenga que apuntar.
  return (
    <div className="mx-auto mt-10 grid w-full max-w-[288px] grid-cols-2 gap-[14px]">
      {items.map((m) => (
        <div
          key={m.id}
          className="flex flex-col items-center justify-end gap-[14px] rounded-[22px] bg-gris-card px-3 pb-[21px] pt-[30px] shadow-sm"
        >
          <IconoModulo id={m.id} className="h-[38px] w-auto" />
          <BotonRosa href={`/${evento.slug}/${m.ruta}`} className="rounded-[10px]! py-[10px]!">
            {textosModulo(evento, m.id).boton}
          </BotonRosa>
        </div>
      ))}
    </div>
  );
}

export function NotaPalomas({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <IconPalomas className="w-9 shrink-0" />
      <p className="text-left font-serif text-xs font-bold leading-snug">{children}</p>
    </div>
  );
}

// Estado vacío: el módulo está encendido pero el organizador todavía no cargó
// contenido. El invitado no debería quedarse mirando una pantalla en blanco.
export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <Tarjeta className="px-6 py-10 text-center">
      <p className="text-sm opacity-70">{children}</p>
    </Tarjeta>
  );
}
