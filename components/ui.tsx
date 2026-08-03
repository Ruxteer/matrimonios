import Link from "next/link";
import { IconCamara, IconMapa, IconPalomas, IconSobre } from "./Icons";

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
  const base = `block w-full rounded-[9px] bg-rosa py-2 text-center text-[13px] font-bold text-white shadow-sm transition hover:brightness-95 disabled:opacity-50 ${className}`;
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

// Tarjeta de acción del inicio: ícono a la izquierda, texto y botón (259px en el diseño).
export function TarjetaAccion({
  icon,
  texto,
  boton,
  href,
}: {
  icon: React.ReactNode;
  texto: React.ReactNode;
  boton: string;
  href: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[259px] rounded-[20px] bg-gris-card p-[15px] shadow-sm">
      <div className="mb-3 flex items-center gap-4 pl-3 pr-1">
        <span className="shrink-0">{icon}</span>
        <p className="font-serif text-xs font-bold leading-snug">{texto}</p>
      </div>
      <BotonRosa href={href}>{boton}</BotonRosa>
    </div>
  );
}

// Atajos cuadrados al pie de mensaje/foto/mapa.
export function Atajos({
  slug,
  omitir,
  sinMapa,
}: {
  slug: string;
  omitir: "mensaje" | "foto" | "mapa";
  sinMapa?: boolean;
}) {
  const items = [
    {
      key: "mensaje",
      href: `/${slug}/mensaje`,
      label: "Enviar mensaje",
      icon: <IconSobre className="h-9 w-auto" />,
    },
    {
      key: "foto",
      href: `/${slug}/foto`,
      label: "Subir foto",
      icon: <IconCamara className="h-9 w-auto" />,
    },
    {
      key: "mapa",
      href: `/${slug}/mapa`,
      label: "Ver mapa",
      icon: <IconMapa className="h-10 w-auto" />,
    },
  ].filter((i) => i.key !== omitir && !(sinMapa && i.key === "mapa"));

  return (
    <div className="mx-auto mt-10 grid w-full max-w-[280px] grid-cols-2 gap-4">
      {items.map((i) => (
        <div
          key={i.key}
          className="flex flex-col items-center justify-end gap-4 rounded-[20px] bg-gris-card px-3 pb-4 pt-6 shadow-sm"
        >
          {i.icon}
          <BotonRosa href={i.href} className="text-xs py-1.5">
            {i.label}
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
