import { notFound } from "next/navigation";
import SubirFoto from "@/components/SubirFoto";
import { Atajos, NotaPalomas } from "@/components/ui";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";

export default async function FotoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "fotos")) notFound();

  return (
    <>
      <h2 className="mb-5 text-center font-serif text-lg font-bold">
        Comparte tus mejores momentos
      </h2>

      <SubirFoto slug={evento.slug} />

      <Atajos evento={evento} omitir="fotos" />

      <NotaPalomas>
        Tu foto será parte de los
        <br /> recuerdos más especiales de este día
      </NotaPalomas>
    </>
  );
}
