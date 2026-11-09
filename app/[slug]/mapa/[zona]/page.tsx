import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { CuadroIcono } from "@/components/MapaZonas";
import { IconoZona } from "@/components/IconosMapa";
import { getEvento, nombreEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { leerMapa } from "@/lib/mapa";
import { urlArchivo } from "@/lib/urls";
import type { Evento } from "@/lib/db";

type Props = { params: Promise<{ slug: string; zona: string }> };

async function buscar({ params }: Props) {
  const { slug, zona: id } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "mapa")) return null;
  const zona = leerMapa(evento.mapa_config).zonas.find((z) => z.id === id);
  return zona ? { evento: evento as Evento, zona } : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const datos = await buscar(props);
  if (!datos) return { title: "Zona no encontrada" };
  return {
    title: `${datos.zona.nombre} · ${nombreEvento(datos.evento)}`,
    description: datos.zona.descripcion || undefined,
  };
}

// Ficha de una zona del mapa (Figma "creative-wiin"): su foto, qué es, lo que
// ofrece y la vuelta al plano.
export default async function ZonaPage(props: Props) {
  const datos = await buscar(props);
  if (!datos) notFound();
  const { evento, zona } = datos;
  const volver = `/${evento.slug}/mapa`;
  const columnas = zona.detalles.length >= 4 ? "grid-cols-4" : zona.detalles.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    // Al volver al mapa, la ficha baja y se desvanece mientras su ícono
    // regresa a ser el punto del plano.
    <ViewTransition exit={{ "nav-back": "vt-zona-sale", default: "none" }} default="none">
      <article className="zona-detalle">
        {/* La foto entra con un leve acercamiento; la hoja sube encima. */}
        <div className="relative overflow-hidden">
          {zona.imagen ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={urlArchivo(zona.imagen)}
              alt={zona.nombre}
              className="zona-foto block aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="zona-foto grid aspect-[16/9] w-full place-items-center bg-gris-card text-rosa">
              <IconoZona icono={zona.icono} className="size-16" grosor={1.5} />
            </div>
          )}
          <Link
            href={volver}
            transitionTypes={["nav-back"]}
            aria-label="Volver al mapa"
            className="absolute left-4 top-4 grid size-10 place-items-center rounded-xl bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/55"
          >
            <ChevronLeft className="size-6" strokeWidth={2.5} aria-hidden="true" />
          </Link>
        </div>

        <div className="zona-hoja relative -mt-7 rounded-t-[28px] bg-background px-6 pb-2 pt-7 shadow-[0_-10px_24px_rgb(0_0_0/0.08)]">
          <div className="flex items-center gap-4">
            {/* Mismo nombre que el punto del plano: es el punto que llegó. */}
            <ViewTransition name={`zona-${zona.id}`} share="vt-zona" default="none">
              <CuadroIcono
                icono={zona.icono}
                className="size-16 rounded-2xl"
                iconoClassName="size-9"
              />
            </ViewTransition>
            <h2 className="font-serif text-[26px] font-bold leading-[1.1]">{zona.nombre}</h2>
          </div>

          {zona.descripcion && (
            <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed">{zona.descripcion}</p>
          )}

          {zona.detalles.length > 0 && (
            <ul className={`mt-5 grid gap-2 ${columnas}`}>
              {zona.detalles.map((d, i) => (
                <li
                  key={i}
                  className="zona-item flex flex-col items-center gap-1.5 rounded-xl border border-current/10 bg-gris-card px-1.5 py-3 text-center shadow-sm"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <IconoZona icono={d.icono} className="size-6 text-rosa" />
                  <span className="text-[12px] leading-tight">{d.texto}</span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={volver}
            transitionTypes={["nav-back"]}
            className="mt-7 flex items-center justify-center gap-2 rounded-full bg-rosa py-3.5 text-[16px] font-semibold text-rosa-texto shadow-sm transition hover:bg-rosa-hover"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
            Volver al mapa
          </Link>
        </div>
      </article>
    </ViewTransition>
  );
}
