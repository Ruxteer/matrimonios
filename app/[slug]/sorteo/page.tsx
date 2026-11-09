import { notFound } from "next/navigation";
import { Atajos, BotonRosa, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { consultar, type Sorteo } from "@/lib/db";
import { getEvento } from "@/lib/eventos";
import { textosModulo } from "@/lib/textos";
import { moduloActivo } from "@/lib/modulos";
import { inscripcionAbierta, leerNombres } from "@/lib/sorteos";
import { urlArchivo } from "@/lib/urls";

// Solo los nombres: el detalle con las columnas de la base (correos, RUT) es
// del panel y nunca se lee aquí.
type SorteoPublico = {
  id: number;
  titulo: string;
  premio: string;
  imagen: string;
  fuente: Sorteo["fuente"];
  fecha_sorteo: string;
  ejecutado_at: string;
  ganadores: string;
  suplentes: string;
};

export default async function SorteoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "sorteos")) notFound();

  // Casi siempre de solo lectura: se participa por estar en la lista del
  // sorteo. Los sorteos por inscripción llevan su botón para anotarse.
  const sorteos = await consultar<SorteoPublico>(
    `SELECT id, titulo, premio, imagen, fuente, fecha_sorteo, ejecutado_at, ganadores, suplentes
       FROM sorteos
      WHERE evento_id = ? AND publicado = 1 ORDER BY id`,
    [evento.id]
  );

  return (
    <>
      <Titulo>{textosModulo(evento, "sorteos").titulo}</Titulo>

      {sorteos.length === 0 ? (
        <Vacio>Todavía no hay sorteos.</Vacio>
      ) : (
        <div className="space-y-4">
          {sorteos.map((sorteo) => {
            const ganadores = leerNombres(sorteo.ganadores);
            const suplentes = leerNombres(sorteo.suplentes);
            return (
              <Tarjeta key={sorteo.id} className="px-5 py-6 text-center">
                {sorteo.imagen && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urlArchivo(sorteo.imagen)}
                    alt=""
                    className="mb-3 aspect-[4/3] w-full rounded-[12px] object-cover"
                  />
                )}
                <p className="font-serif text-sm font-bold">{sorteo.titulo}</p>
                {sorteo.premio && (
                  <p className="mt-1 text-xs opacity-70">{sorteo.premio}</p>
                )}

                {ganadores.length > 0 ? (
                  <div className="mt-4 space-y-1">
                    {ganadores.map((nombre) => (
                      <p
                        key={nombre}
                        className="font-serif text-xl font-bold leading-tight text-dorado"
                      >
                        {nombre}
                      </p>
                    ))}
                    {suplentes.length > 0 && (
                      <p className="pt-3 text-xs opacity-70">
                        Suplentes: {suplentes.join(", ")}
                      </p>
                    )}
                  </div>
                ) : inscripcionAbierta(sorteo) ? (
                  <BotonRosa href={`/${evento.slug}/sorteo/${sorteo.id}`} className="mt-4">
                    Participar
                  </BotonRosa>
                ) : (
                  <p className="mt-4 text-xs opacity-60">
                    {evento.tipo === "activacion" ? "Se sortea durante el evento" : "Se sortea durante la fiesta"}
                  </p>
                )}
              </Tarjeta>
            );
          })}
        </div>
      )}

      <Atajos evento={evento} omitir="sorteos" />
    </>
  );
}
