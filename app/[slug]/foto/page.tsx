import { notFound } from "next/navigation";
import SubirFoto from "@/components/SubirFoto";
import { Atajos, NotaPalomas } from "@/components/ui";
import { getEvento } from "@/lib/eventos";

export default async function FotoPage({
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
        Comparte tus mejores momentos
      </h2>

      <SubirFoto slug={evento.slug} />

      <Atajos slug={evento.slug} omitir="foto" sinMapa={!evento.mapa} />

      <NotaPalomas>
        Tu foto será parte de los
        <br /> recuerdos más especiales de este día
      </NotaPalomas>
    </>
  );
}
