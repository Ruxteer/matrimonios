import { notFound } from "next/navigation";
import TriviaInvitado, { type TriviaPublica } from "@/components/TriviaInvitado";
import { Atajos, Titulo, Vacio } from "@/components/ui";
import { consultar, type PreguntaTrivia, type Trivia } from "@/lib/db";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";

function alternativas(json: string): string[] {
  try {
    const valor = JSON.parse(json || "[]");
    return Array.isArray(valor) ? valor.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

export default async function TriviaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "trivia")) notFound();

  const trivias = await consultar<Trivia>(
    "SELECT * FROM trivias WHERE evento_id = ? AND abierta = 1 ORDER BY orden, id",
    [evento.id]
  );
  const preguntas = trivias.length
    ? await consultar<PreguntaTrivia>(
        `SELECT * FROM trivia_preguntas WHERE trivia_id IN (${trivias
          .map(() => "?")
          .join(", ")}) ORDER BY orden, id`,
        trivias.map((t) => t.id)
      )
    : [];

  // Lo que se le manda al navegador se arma aquí, y a propósito deja fuera las
  // correctas y la explicación: eso llega recién al enviar la partida.
  const jugables: TriviaPublica[] = trivias
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      descripcion: t.descripcion,
      preguntas: preguntas
        .filter((p) => p.trivia_id === t.id)
        .map((p) => ({
          id: p.id,
          enunciado: p.enunciado,
          opciones: alternativas(p.opciones),
        })),
    }))
    .filter((t) => t.preguntas.length > 0);

  return (
    <>
      {/* El título de la página no repite el de la trivia: la que carga el
          organizador casi siempre se llama "¿Cuánto conoces a los novios?". */}
      <Titulo>Pon a prueba lo que sabes</Titulo>

      {jugables.length ? (
        <TriviaInvitado slug={evento.slug} trivias={jugables} />
      ) : (
        <Vacio>Todavía no hay ninguna trivia.</Vacio>
      )}

      <Atajos evento={evento} omitir="trivia" />
    </>
  );
}
