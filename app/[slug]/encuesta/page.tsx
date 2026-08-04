import { notFound } from "next/navigation";
import EncuestaInvitado, { type EncuestaPublica } from "@/components/EncuestaInvitado";
import { Atajos, Titulo, Vacio } from "@/components/ui";
import { consultar } from "@/lib/db";
import type { Encuesta, PreguntaEncuesta } from "@/lib/db";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";

function opcionesDe(json: string): string[] {
  try {
    const leido = JSON.parse(json || "[]");
    return Array.isArray(leido) ? leido.map((o) => String(o)) : [];
  } catch {
    return [];
  }
}

export default async function EncuestaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "encuestas")) notFound();

  const filas = await consultar<
    Pick<Encuesta, "id" | "titulo" | "descripcion" | "mensaje_final" | "pide_nombre">
  >(
    `SELECT id, titulo, descripcion, mensaje_final, pide_nombre FROM encuestas
      WHERE evento_id = ? AND abierta = 1 ORDER BY orden, id`,
    [evento.id]
  );
  const preguntas = await consultar<PreguntaEncuesta>(
    `SELECT p.* FROM encuesta_preguntas p
       JOIN encuestas e ON e.id = p.encuesta_id
      WHERE e.evento_id = ? AND e.abierta = 1
      ORDER BY p.orden, p.id`,
    [evento.id]
  );

  // Una encuesta sin preguntas no tiene nada que preguntar: no se muestra.
  const encuestas: EncuestaPublica[] = filas
    .map((e) => ({
      id: e.id,
      titulo: e.titulo,
      descripcion: e.descripcion,
      mensaje_final: e.mensaje_final,
      pide_nombre: e.pide_nombre,
      preguntas: preguntas
        .filter((p) => p.encuesta_id === e.id)
        .map((p) => ({
          id: p.id,
          texto: p.texto,
          tipo: p.tipo,
          opciones: opcionesDe(p.opciones),
          obligatoria: p.obligatoria,
        })),
    }))
    .filter((e) => e.preguntas.length > 0);

  return (
    <>
      <Titulo>Queremos conocer tu opinión</Titulo>

      {encuestas.length === 0 ? (
        <Vacio>Todavía no hay ninguna encuesta.</Vacio>
      ) : (
        <EncuestaInvitado slug={evento.slug} encuestas={encuestas} />
      )}

      <Atajos evento={evento} omitir="encuestas" />
    </>
  );
}
