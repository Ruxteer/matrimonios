import { notFound } from "next/navigation";
import InscripcionSorteo from "@/components/InscripcionSorteo";
import { Atajos, Tarjeta, Titulo } from "@/components/ui";
import { uno, type Sorteo } from "@/lib/db";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { inscripcionAbierta, leerNombres } from "@/lib/sorteos";
import { urlArchivo } from "@/lib/urls";

export const dynamic = "force-dynamic";

// Hora del sorteo en Chile, que es donde están los eventos.
function cuandoEs(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  // «miércoles 11 de noviembre a las 23:52»: con 24 horas, porque «p. m.»
  // termina en punto y choca con el de la frase.
  const zona = { timeZone: "America/Santiago" } as const;
  const dia = fecha.toLocaleDateString("es-CL", { ...zona, weekday: "long", day: "numeric", month: "long" });
  const hora = fecha.toLocaleTimeString("es-CL", { ...zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${dia.replace(",", "")} a las ${hora}`;
}

// A donde lleva el QR de la pantalla de un sorteo: la foto del premio y el
// formulario para entrar. Si el sorteo no es por inscripción, o ya pasó, lo dice.
export default async function SorteoInscripcion({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "sorteos")) notFound();
  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (!sorteo) notFound();

  const ganadores = sorteo.publicado ? leerNombres(sorteo.ganadores) : [];
  const abierta = inscripcionAbierta(sorteo);
  const fecha = sorteo.fecha_sorteo ? cuandoEs(sorteo.fecha_sorteo) : "";

  return (
    <>
      <Titulo>{sorteo.titulo}</Titulo>

      <Tarjeta>
        {sorteo.imagen && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlArchivo(sorteo.imagen)}
            alt={sorteo.premio || "Premio del sorteo"}
            className="mb-3 aspect-[4/3] w-full rounded-[12px] object-cover"
          />
        )}
        {sorteo.premio && (
          <div className="mb-3 pl-1">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] opacity-60">Premio</p>
            <p className="font-serif text-base font-bold leading-snug">{sorteo.premio}</p>
          </div>
        )}

        {sorteo.ejecutado_at ? (
          <div className="rounded-[10px] bg-white px-4 py-6 text-center">
            {ganadores.length > 0 ? (
              <>
                <p className="text-[12px] opacity-70">{ganadores.length > 1 ? "Ganadores" : "Ganador"}</p>
                {ganadores.map((nombre) => (
                  <p key={nombre} className="font-serif text-xl font-bold leading-tight text-dorado">
                    {nombre}
                  </p>
                ))}
              </>
            ) : (
              <p className="font-serif text-base font-bold">El sorteo ya se realizó</p>
            )}
            <p className="mt-2 text-[12px] opacity-70">¡Gracias por participar!</p>
          </div>
        ) : sorteo.fuente !== "inscritos" ? (
          <p className="rounded-[10px] bg-white px-4 py-5 text-center text-[12px] leading-snug">
            No necesitas inscribirte: el organizador ya tiene la lista de quienes participan.
            {fecha && ` Se sortea el ${fecha}.`}
          </p>
        ) : abierta ? (
          <>
            {fecha && <p className="mb-3 pl-1 text-[12px] opacity-75">Se sortea el {fecha}.</p>}
            <InscripcionSorteo slug={evento.slug} id={sorteo.id} />
          </>
        ) : (
          <p className="rounded-[10px] bg-white px-4 py-5 text-center text-[12px] leading-snug">
            Las inscripciones cerraron. ¡Atento a la pantalla, ahí sale el ganador!
          </p>
        )}
      </Tarjeta>

      <Atajos evento={evento} omitir="sorteos" />
    </>
  );
}
