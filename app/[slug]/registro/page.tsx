import { notFound } from "next/navigation";
import FormularioRegistro from "@/components/FormularioRegistro";
import { Atajos } from "@/components/ui";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { registroConfig } from "@/lib/registro";

export default async function RegistroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "registro")) notFound();

  return (
    <>
      <FormularioRegistro slug={evento.slug} config={registroConfig(evento)} fotosActivo={moduloActivo(evento, "fotos")} volverInicio={evento.tipo !== "activacion"} activacion={evento.tipo === "activacion"} />
      <Atajos evento={evento} omitir="registro" />
    </>
  );
}
