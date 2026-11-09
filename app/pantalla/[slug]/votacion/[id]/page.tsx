import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PantallaVotacion from "@/components/pantalla/PantallaVotacion";
import { cookieAdminValida, esAdminDeEventoCookie } from "@/lib/auth";
import { eventoPublico, getEvento, nombreEvento, tokenPantallaValido } from "@/lib/eventos";
import { votacionParaPantalla } from "@/lib/votaciones";
import ClaveInvalida from "@/components/pantalla/ClaveInvalida";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const evento = await getEvento(slug);
  return {
    title: evento ? `Votación en vivo · ${nombreEvento(evento)}` : "Votación en vivo",
    robots: { index: false, follow: false },
  };
}

// La votación proyectada en el salón: alternativas con sus fotos, barras que se
// mueven a medida que llegan los votos y el QR para sumarse.
export default async function Pagina({ params, searchParams }: Props) {
  const { slug, id } = await params;
  const query = await searchParams;
  const evento = await getEvento(slug);
  if (!evento) notFound();

  const clave = texto(query.k);
  const galletas = await cookies();
  const permitido =
    tokenPantallaValido(evento, clave) ||
    cookieAdminValida(galletas.get("admin")?.value ?? "") ||
    esAdminDeEventoCookie(evento, galletas.get("evento")?.value ?? "");
  if (!permitido) return <ClaveInvalida />;

  const votacion = await votacionParaPantalla(evento.id, Number(id));
  if (!votacion) notFound();
  return <PantallaVotacion evento={eventoPublico(evento)} inicial={votacion} clave={clave} />;
}
