import { notFound } from "next/navigation";
import { Atajos, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { consultar, type Actividad } from "@/lib/db";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "agenda")) notFound();

  const actividades = await consultar<Actividad>(
    "SELECT * FROM agenda WHERE evento_id = ? ORDER BY orden, hora",
    [evento.id]
  );

  // Un matrimonio de un día no necesita leer la fecha en cada actividad: los
  // días solo se separan cuando la celebración se reparte en más de uno.
  const dias = [...new Set(actividades.map((a) => a.dia))];
  const grupos =
    dias.length > 1
      ? dias.map((dia) => ({ dia, delDia: actividades.filter((a) => a.dia === dia) }))
      : [{ dia: "", delDia: actividades }];

  return (
    <>
      <Titulo>El programa del día</Titulo>

      {actividades.length === 0 ? (
        <Vacio>El programa de la celebración se publicará pronto.</Vacio>
      ) : (
        grupos.map(({ dia, delDia }) => (
          <section key={dia} className="mb-6 last:mb-0">
            {dia && (
              <h3 className="mb-3 text-center font-serif text-sm font-bold text-dorado">
                {dia}
              </h3>
            )}
            <ol className="mx-auto w-full max-w-[327px]">
              {delDia.map((actividad, i) => (
                <li key={actividad.id} className="flex gap-2">
                  <p className="w-11 shrink-0 pt-[17px] text-right font-serif text-xs font-bold text-dorado">
                    {actividad.hora}
                  </p>
                  {/* La línea une una actividad con la siguiente: se corta arriba
                      de la primera y abajo de la última. */}
                  <div className="relative w-2 shrink-0" aria-hidden>
                    {i > 0 && (
                      <span className="absolute left-1/2 top-0 h-[25px] w-px -translate-x-1/2 bg-rosa" />
                    )}
                    {i < delDia.length - 1 && (
                      <span className="absolute bottom-0 left-1/2 top-[25px] w-px -translate-x-1/2 bg-rosa" />
                    )}
                    <span className="absolute left-1/2 top-[21px] h-2 w-2 -translate-x-1/2 rounded-full bg-rosa" />
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <Tarjeta>
                      <p className="font-serif text-sm font-bold">{actividad.titulo}</p>
                      {actividad.lugar && (
                        <p className="mt-1 font-serif text-xs font-bold text-dorado">
                          {actividad.lugar}
                        </p>
                      )}
                      {actividad.descripcion && (
                        <p className="mt-2 text-xs leading-snug opacity-80">
                          {actividad.descripcion}
                        </p>
                      )}
                    </Tarjeta>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}

      <Atajos evento={evento} omitir="agenda" />
    </>
  );
}
