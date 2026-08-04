import { notFound } from "next/navigation";
import VotacionInvitado, { type VotacionPublica } from "@/components/VotacionInvitado";
import { Atajos, Titulo, Vacio } from "@/components/ui";
import { consultar, type OpcionVotacion, type Votacion } from "@/lib/db";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";

export default async function VotacionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "votaciones")) notFound();

  const votaciones = await consultar<Votacion>(
    "SELECT * FROM votaciones WHERE evento_id = ? AND abierta = 1 ORDER BY orden, id",
    [evento.id]
  );
  const opciones = await consultar<OpcionVotacion & { votos: number }>(
    `SELECT o.*, (SELECT COUNT(*) FROM votos v WHERE v.opcion_id = o.id) AS votos
       FROM votacion_opciones o
      WHERE o.votacion_id IN (SELECT id FROM votaciones WHERE evento_id = ? AND abierta = 1)
      ORDER BY o.orden, o.id`,
    [evento.id]
  );

  const abiertas: VotacionPublica[] = votaciones
    .map((v) => {
      const propias = opciones.filter((o) => o.votacion_id === v.id);
      // Estas votaciones están abiertas: solo las de resultados en vivo pueden
      // entregar los conteos, el resto ni siquiera los manda al teléfono.
      const mostrar = v.resultados === "siempre";
      return {
        ...v,
        // Las filas de la base no son objetos planos: hay que copiarlas para
        // poder pasárselas a un componente cliente.
        opciones: propias.map(({ votos, ...o }) => (mostrar ? { ...o, votos } : o)),
        total: mostrar ? propias.reduce((n, o) => n + o.votos, 0) : undefined,
        votada: false,
        elegidas: [],
      };
    })
    // Una votación sin alternativas todavía se está armando en el panel.
    .filter((v) => v.opciones.length > 0);

  return (
    <>
      <Titulo>Vota y elige tu favorita</Titulo>

      {abiertas.length === 0 ? (
        <Vacio>Todavía no hay ninguna votación.</Vacio>
      ) : (
        <VotacionInvitado slug={evento.slug} inicial={abiertas} />
      )}

      <Atajos evento={evento} omitir="votaciones" />
    </>
  );
}
