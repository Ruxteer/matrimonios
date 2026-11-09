import { notFound } from "next/navigation";
import ResultadoMesa from "@/components/ResultadoMesa";
import { Atajos } from "@/components/ui";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { textosModulo } from "@/lib/textos";

export default async function MesaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "mesa")) notFound();

  const textos = textosModulo(evento, "mesa");
  return (
    <>
      <ResultadoMesa
        slug={evento.slug}
        titulo={textos.titulo}
        boton={textos.boton}
        sector={evento.tipo === "activacion"}
      />
      <Atajos evento={evento} omitir="mesa" />
    </>
  );
}
