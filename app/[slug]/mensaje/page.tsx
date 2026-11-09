import { notFound } from "next/navigation";
import FormularioMensaje from "@/components/FormularioMensaje";
import { Atajos, NotaPalomas } from "@/components/ui";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { textosModulo } from "@/lib/textos";

export default async function MensajePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "mensajes")) notFound();

  return (
    <>
      <h2 className="mb-5 text-center font-serif text-lg font-bold">
        {textosModulo(evento, "mensajes").titulo}
      </h2>

      <FormularioMensaje slug={evento.slug} />

      <Atajos evento={evento} omitir="mensajes" />

      <NotaPalomas>
        Tu mensaje será parte de los
        <br /> recuerdos más especiales de este día
      </NotaPalomas>
    </>
  );
}
