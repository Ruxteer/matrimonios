import { notFound } from "next/navigation";
import BuscadorMesa from "@/components/BuscadorMesa";
import { TarjetaAccion, Vacio } from "@/components/ui";
import { IconoModulo } from "@/components/Icons";
import { getEvento } from "@/lib/eventos";
import { modulosActivos } from "@/lib/modulos";

export default async function Inicio({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) notFound();

  // El inicio se arma con los módulos que el matrimonio dejó encendidos, en su
  // orden. La mesa va destacada arriba (es el buscador), el resto son tarjetas.
  const modulos = modulosActivos(evento);
  const buscador = modulos.find((m) => m.destacado);
  const tarjetas = modulos.filter((m) => !m.destacado);

  return (
    <>
      <h2 className="mb-5 text-center font-serif text-lg font-bold">
        Hola, nos alegra que estés aquí
      </h2>

      {buscador && <BuscadorMesa slug={evento.slug} />}

      {tarjetas.length > 0 && (
        <>
          <h2 className="mb-4 mt-6 text-center font-serif text-lg font-bold">
            Durante el evento podrás:
          </h2>
          <div className="space-y-3">
            {tarjetas.map((m) => (
              <TarjetaAccion
                key={m.id}
                icon={<IconoModulo id={m.id} className="h-[34px] w-auto" />}
                texto={m.tarjeta}
                boton={m.boton}
                href={`/${evento.slug}/${m.ruta}`}
              />
            ))}
          </div>
        </>
      )}

      {modulos.length === 0 && (
        <Vacio>Muy pronto vas a encontrar todo lo del evento aquí.</Vacio>
      )}
    </>
  );
}
