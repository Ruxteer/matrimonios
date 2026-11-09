import { ViewTransition } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Atajos, NotaPalomas } from "@/components/ui";
import { CuadroIcono, PuntoZona } from "@/components/MapaZonas";
import PlanoMapa from "@/components/PlanoMapa";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { leerMapa, SUBTITULO_MAPA } from "@/lib/mapa";
import { textosModulo } from "@/lib/textos";
import { urlArchivo } from "@/lib/urls";

export default async function MapaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  // El módulo Mapa solo está disponible cuando hay un plano subido.
  if (!evento || !moduloActivo(evento, "mapa")) notFound();

  const { zonas, leyenda, subtitulo } = leerMapa(evento.mapa_config);
  const activacion = evento.tipo === "activacion";
  // Sin zonas el plano es solo una imagen: no hay nada que invitar a tocar.
  const bajada = subtitulo || (zonas.length ? SUBTITULO_MAPA : "");
  const ancho = activacion ? "" : "max-w-[344px]";

  return (
    // En las activaciones el mapa va en una hoja que se monta sobre el banner,
    // como en el mockup del festival; en los matrimonios, sobre el fondo.
    // Al ir a una zona, el mapa se retira suave mientras su punto se transforma.
    <ViewTransition exit={{ "nav-forward": "vt-mapa-sale", default: "none" }} default="none">
      <div className={activacion ? "mapa-hoja" : ""}>
        <h2 className={`text-center font-serif text-xl font-bold ${bajada ? "mb-2" : "mb-5"}`}>
          {textosModulo(evento, "mapa").titulo}
        </h2>
        {bajada && (
          <p className="mx-auto mb-5 max-w-[34ch] text-center text-[13px] leading-snug opacity-80">
            {bajada}
          </p>
        )}

        {/* Las zonas van en porcentaje del plano: siguen en su lugar a cualquier ancho. */}
        <div className={`mx-auto w-full ${ancho}`}>
          <PlanoMapa src={urlArchivo(evento.mapa)}>
            {zonas.map((z, i) => (
              <Link
                key={z.id}
                href={`/${evento.slug}/mapa/${z.id}`}
                transitionTypes={["nav-forward"]}
                aria-label={`${z.nombre}: ver la zona`}
                title={z.nombre}
                // El punto es chico para no tapar el plano, pero se toca con
                // holgura: el área de toque se extiende alrededor. --i escalona
                // la entrada y el latido de cada punto.
                className="zona-enlace absolute -translate-x-1/2 -translate-y-1/2 rounded-full before:absolute before:-inset-2.5 before:rounded-full before:content-[''] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-current"
                style={{ left: `${z.x}%`, top: `${z.y}%`, "--i": i } as React.CSSProperties}
              >
                {/* El mismo nombre que el ícono de la ficha: al tocarlo, el
                    punto se transforma en él (y vuelve al regresar). */}
                <ViewTransition name={`zona-${z.id}`} share="vt-zona" default="none">
                  <PuntoZona icono={z.icono} />
                </ViewTransition>
              </Link>
            ))}
          </PlanoMapa>
        </div>

        {leyenda.length > 0 && (
          <ul
            aria-label="Leyenda del mapa"
            className={`mx-auto mt-5 grid w-full grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-x-3 gap-y-3 border-t border-current/15 pt-4 ${ancho}`}
          >
            {leyenda.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <CuadroIcono icono={item.icono} />
                <span className="max-w-[11ch] text-[11px] leading-tight">{item.texto}</span>
              </li>
            ))}
          </ul>
        )}

        <Atajos evento={evento} omitir="mapa" />

        {!activacion && <NotaPalomas>Tu presencia es el mejor regalo</NotaPalomas>}
      </div>
    </ViewTransition>
  );
}
