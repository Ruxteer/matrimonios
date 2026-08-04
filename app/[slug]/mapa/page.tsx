import { notFound } from "next/navigation";
import { Atajos, NotaPalomas } from "@/components/ui";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
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

  return (
    <>
      <h2 className="mb-5 text-center font-serif text-lg font-bold">Explora el lugar</h2>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urlArchivo(evento.mapa)}
        alt="Plano del lugar"
        className="mx-auto w-full max-w-[320px] rounded-[14px] shadow-sm"
      />

      <Atajos evento={evento} omitir="mapa" />

      <NotaPalomas>Tu presencia es el mejor regalo</NotaPalomas>
    </>
  );
}
