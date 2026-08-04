import { notFound } from "next/navigation";
import ResultadoMesa from "@/components/ResultadoMesa";
import { Atajos } from "@/components/ui";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";

export default async function MesaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "mesa")) notFound();

  return (
    <>
      <ResultadoMesa slug={evento.slug} />
      <Atajos evento={evento} omitir="mesa" />
    </>
  );
}
