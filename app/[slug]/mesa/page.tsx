import { notFound } from "next/navigation";
import ResultadoMesa from "@/components/ResultadoMesa";
import { Atajos } from "@/components/ui";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { asignacionEvento, leerTextos, predeterminados, textosModulo } from "@/lib/textos";

export default async function MesaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "mesa")) notFound();

  const textos = textosModulo(evento, "mesa");
  const asignacion = asignacionEvento(evento);
  // Con el botón predeterminado ("Buscar mi mesa"), al reintentar dice "Buscar de nuevo".
  const predeterminado = predeterminados(evento.tipo, "mesa", leerTextos(evento.textos).asignacion).boton;
  return (
    <>
      <ResultadoMesa
        slug={evento.slug}
        titulo={textos.titulo}
        boton={textos.boton === predeterminado ? "Buscar de nuevo" : textos.boton}
        palabra={asignacion.nombre}
        femenino={asignacion.femenino}
      />
      <Atajos evento={evento} omitir="mesa" />
    </>
  );
}
