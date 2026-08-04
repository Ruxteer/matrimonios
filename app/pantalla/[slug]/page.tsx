import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PantallaSalon, { type ModoPantalla } from "@/components/PantallaSalon";
import { cookieAdminValida } from "@/lib/auth";
import { eventoPublico, getEvento, nombreEvento, tokenPantallaValido } from "@/lib/eventos";
import { datosPantalla } from "@/lib/pantalla";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const evento = await getEvento(slug);
  return {
    title: evento ? `Pantalla · ${nombreEvento(evento)}` : "Pantalla",
    robots: { index: false, follow: false },
  };
}

// Vista para proyectar en el salón: rota las fotos y los mensajes que van
// llegando y deja el QR siempre visible para que se sumen más invitados.
export default async function Pantalla({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const evento = await getEvento(slug);
  if (!evento) notFound();

  const clave = texto(query.k);
  const galletas = await cookies();
  const permitido =
    tokenPantallaValido(evento, clave) ||
    cookieAdminValida(galletas.get("admin")?.value ?? "");
  if (!permitido) return <ClaveInvalida />;

  const modo = texto(query.modo);
  return (
    <PantallaSalon
      evento={eventoPublico(evento)}
      inicial={await datosPantalla(evento.id)}
      clave={clave}
      modo={modo === "fotos" || modo === "mensajes" ? (modo as ModoPantalla) : "todo"}
      fondoOscuro={texto(query.fondo) === "oscuro"}
    />
  );
}

function ClaveInvalida() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Esta dirección no es válida</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        La pantalla del salón se abre con el enlace que aparece en el panel del matrimonio,
        en Ajustes.
      </p>
    </main>
  );
}
