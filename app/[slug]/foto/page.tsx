import { notFound } from "next/navigation";
import SubirFoto from "@/components/SubirFoto";
import { Atajos, NotaPalomas } from "@/components/ui";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { registroConfig } from "@/lib/registro";
import { participanteActual } from "@/lib/registro-servidor";
import { contarFotos } from "@/lib/fotos";

export default async function FotoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "fotos")) notFound();
  const config = registroConfig(evento);
  const participante = await participanteActual(null, evento);
  const fotosUsadas = participante ? await contarFotos(evento.id, participante.id) : 0;
  const activacion = evento.tipo === "activacion";

  return (
    <>
      {!activacion && <h2 className="mb-5 text-center font-serif text-lg font-bold">
        Comparte tus mejores momentos
      </h2>}

      <SubirFoto
        slug={evento.slug}
        participanteNombre={participante?.nombre ?? null}
        requiereRegistro={moduloActivo(evento, "registro") && config.fotos_requiere_registro}
        maxFotos={config.fotos_por_participante}
        fotosUsadas={fotosUsadas}
        moderacion={config.fotos_moderacion}
        activacion={activacion}
      />

      <Atajos evento={evento} omitir="fotos" />

      {!activacion && <NotaPalomas>
        Tu foto será parte de los
        <br /> recuerdos más especiales de este día
      </NotaPalomas>}
    </>
  );
}
