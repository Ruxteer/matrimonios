import { notFound } from "next/navigation";
import { Atajos, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { consultar } from "@/lib/db";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { leerNombres } from "@/lib/sorteos";

// Solo los nombres: el detalle con las columnas de la base (correos, RUT) es
// del panel y nunca se lee aquí.
type SorteoPublico = {
  id: number;
  titulo: string;
  premio: string;
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

  // Pantalla de solo lectura: al invitado no se le pide nada, participa por
  // estar en la lista del sorteo.
  const sorteos = await consultar<SorteoPublico>(
    `SELECT id, titulo, premio, ganadores, suplentes FROM sorteos
      WHERE evento_id = ? AND publicado = 1 ORDER BY id`,
    [evento.id]
  );

  return (
    <>
      <Titulo>Los sorteos de la noche</Titulo>

      {sorteos.length === 0 ? (
        <Vacio>Todavía no hay sorteos.</Vacio>
      ) : (
        <div className="space-y-4">
          {sorteos.map((sorteo) => {
            const ganadores = leerNombres(sorteo.ganadores);
            const suplentes = leerNombres(sorteo.suplentes);
            return (
              <Tarjeta key={sorteo.id} className="px-5 py-6 text-center">
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
                ) : (
                  <p className="mt-4 text-xs opacity-60">Se sortea durante la fiesta</p>
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
