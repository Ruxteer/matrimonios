import { notFound } from "next/navigation";
import { Atajos, NotaPalomas } from "@/components/ui";
import { getEvento, urlArchivo } from "@/lib/eventos";

export default async function MapaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = getEvento(slug);
  if (!evento) notFound();

  return (
    <>
      <h2 className="mb-5 text-center font-serif text-lg font-bold">Explora el lugar</h2>

      {evento.mapa ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={urlArchivo(evento.mapa)}
          alt="Plano del lugar"
          className="mx-auto w-full max-w-[320px] rounded-[14px] shadow-sm"
        />
      ) : (
        <p className="mx-auto max-w-[259px] rounded-[20px] bg-gris-card px-6 py-10 text-center text-sm opacity-70 shadow-sm">
          El plano del lugar estará disponible pronto.
        </p>
      )}

      <Atajos slug={evento.slug} omitir="mapa" />

      <NotaPalomas>Tu presencia es el mejor regalo</NotaPalomas>
    </>
  );
}
