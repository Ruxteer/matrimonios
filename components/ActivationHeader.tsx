"use client";

import { usePathname } from "next/navigation";

/** El banner de la campaña cambia de fotografía en el paso de compartir. */
export default function ActivationHeader({
  titulo,
  descripcion,
  fecha,
  banner,
  bannerMovil,
  mostrarTexto,
}: {
  titulo: string;
  descripcion: string;
  fecha: string;
  banner: string;
  bannerMovil: string;
  mostrarTexto: boolean;
}) {
  const ruta = usePathname();
  const esFoto = ruta.endsWith("/foto");
  const esCarozzi = banner === "/design/carozzi-registro.webp";
  const imagen = esCarozzi && esFoto ? "/design/carozzi-foto.webp" : banner;
  const movil = esCarozzi && esFoto ? imagen : bannerMovil || imagen;
  return (
    <header className={`activation-header ${imagen ? "activation-header-art" : ""}`}>
      {imagen && !mostrarTexto && <h1 className="sr-only">{titulo}</h1>}
      {imagen && (
        <picture>
          <source media="(max-width: 767px)" srcSet={movil} />
          <img src={imagen} alt={titulo} fetchPriority="high" className="activation-banner" />
        </picture>
      )}
      {(!imagen || mostrarTexto) && (
        <div className="activation-header-copy">
          {fecha && <p className="activation-date">{fecha}</p>}
          <h1>{titulo}</h1>
          {descripcion && <p className="activation-description">{descripcion}</p>}
        </div>
      )}
    </header>
  );
}
