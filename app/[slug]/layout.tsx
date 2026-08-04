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
  if (!evento) return { title: "Matrimonio no encontrado" };
  return {
    title: `Matrimonio de ${nombreEvento(evento)}`,
    description: "Busca tu mesa, deja tus buenos deseos y comparte tus fotos.",
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
