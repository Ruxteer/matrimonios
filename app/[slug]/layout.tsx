import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventShell from "@/components/EventShell";
import { getEvento, nombreEvento } from "@/lib/eventos";

type Props = { params: Promise<{ slug: string }> };

// Todo el sitio del invitado se arma con lo que hay en la base en ese momento
// (colores, módulos encendidos, contenido de cada módulo): lo que se cambia en
// el panel tiene que verse en la siguiente visita, no en el siguiente deploy.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return { title: "Evento no encontrado" };
  return {
    title: evento.tipo === "activacion" ? nombreEvento(evento) : `Matrimonio de ${nombreEvento(evento)}`,
    description: evento.descripcion || "Participa en el evento y comparte tus mejores momentos.",
  };
}

export default async function EventoLayout({
  children,
  params,
}: Props & { children: React.ReactNode }) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) notFound();
  return <EventShell evento={evento}>{children}</EventShell>;
}
