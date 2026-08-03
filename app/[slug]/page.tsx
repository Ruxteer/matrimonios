import { notFound } from "next/navigation";
import BuscadorMesa from "@/components/BuscadorMesa";
import { TarjetaAccion } from "@/components/ui";
import { IconCamara, IconMapa, IconSobre } from "@/components/Icons";
import { getEvento } from "@/lib/eventos";

export default async function Inicio({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) notFound();

  return (
    <>
      <h2 className="mb-5 text-center font-serif text-lg font-bold">
        Hola, nos alegra que estés aquí
      </h2>

      <BuscadorMesa slug={evento.slug} />

      <h2 className="mb-4 mt-6 text-center font-serif text-lg font-bold">
        Durante el evento podrás:
      </h2>

      <div className="space-y-3">
        <TarjetaAccion
          icon={<IconSobre className="h-[34px] w-auto" />}
          texto={
            <>
              Deja tus buenos deseos
              <br /> para los novios
            </>
          }
          boton="Enviar mensaje"
          href={`/${evento.slug}/mensaje`}
        />
        <TarjetaAccion
          icon={<IconCamara className="h-[34px] w-auto" />}
          texto={
            <>
              Comparte tus mejores
              <br /> momentos del evento
            </>
          }
          boton="Subir foto"
          href={`/${evento.slug}/foto`}
        />
        {evento.mapa && (
          <TarjetaAccion
            icon={<IconMapa className="h-[41px] w-auto" />}
            texto={
              <>
                Explora el plano y<br /> encuentra todo fácilmente
              </>
            }
            boton="Ver mapa"
            href={`/${evento.slug}/mapa`}
          />
        )}
      </div>
    </>
  );
}
