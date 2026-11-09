import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PantallaSorteo from "@/components/pantalla/PantallaSorteo";
import { cookieAdminValida, esAdminDeEventoCookie } from "@/lib/auth";
import { eventoPublico, getEvento, nombreEvento, tokenPantallaValido } from "@/lib/eventos";
import { uno, type Sorteo } from "@/lib/db";
import { sorteoParaPantalla } from "@/lib/sorteos";
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
    title: evento ? `Sorteo en vivo · ${nombreEvento(evento)}` : "Sorteo en vivo",
    robots: { index: false, follow: false },
  };
}

// El sorteo proyectado en el salón: la cuenta regresiva con el QR para
// inscribirse, la tómbola con los nombres y el ganador en grande.
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

  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (!sorteo) notFound();
  const inicial = await sorteoParaPantalla(sorteo, evento.id, { nombres: true });
  return <PantallaSorteo evento={eventoPublico(evento)} inicial={inicial} clave={clave} />;
}
