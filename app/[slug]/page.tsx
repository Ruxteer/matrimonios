import { notFound, redirect } from "next/navigation";
import BuscadorMesa from "@/components/BuscadorMesa";
import { TarjetaAccion, Vacio } from "@/components/ui";
import { IconoModulo } from "@/components/Icons";
import { getEvento } from "@/lib/eventos";
import { modulosActivos } from "@/lib/modulos";
import { textosInicio, textosModulo } from "@/lib/textos";

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
  if (evento.tipo === "activacion" && modulos.some((m) => m.id === "registro")) redirect(`/${evento.slug}/registro`);
  const buscador = modulos.find((m) => m.destacado);
  const tarjetas = modulos.filter((m) => !m.destacado);
  const inicio = textosInicio(evento);
  const textosBuscador = buscador ? textosModulo(evento, buscador.id) : null;

  return (
    <>
      <h2 className="mb-5 text-center font-serif text-lg font-bold">{inicio.saludo}</h2>

      {textosBuscador && (
        <BuscadorMesa slug={evento.slug} titulo={textosBuscador.titulo} boton={textosBuscador.boton} />
      )}

      {tarjetas.length > 0 && (
        <>
          <h2 className="mb-4 mt-6 text-center font-serif text-lg font-bold">{inicio.durante}</h2>
          <div className="space-y-3">
            {tarjetas.map((m) => {
              const textos = textosModulo(evento, m.id);
              return (
                <TarjetaAccion
                  key={m.id}
                  icon={<IconoModulo id={m.id} className="h-[34px] w-auto" />}
                  texto={textos.tarjeta}
                  boton={textos.boton}
                  href={`/${evento.slug}/${m.ruta}`}
                />
              );
            })}
          </div>
        </>
      )}

      {modulos.length === 0 && (
        <Vacio>Muy pronto vas a encontrar todo lo del evento aquí.</Vacio>
      )}
    </>
  );
}
