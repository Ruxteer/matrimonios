import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventShell from "@/components/EventShell";
import { getEvento, nombreEvento } from "@/lib/eventos";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const evento = getEvento(slug);
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
  const evento = getEvento(slug);
  if (!evento) notFound();
  return <EventShell evento={evento}>{children}</EventShell>;
}
