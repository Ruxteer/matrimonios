import { NextRequest, NextResponse } from "next/server";
import { leerImagen, NOMBRE_VALIDO } from "@/lib/archivos";
import { uno, type Evento } from "@/lib/db";
import { isAdmin, puedeAdministrar } from "@/lib/auth";
import { eventoDeSesion, tokenPantallaValido } from "@/lib/eventos";
import { participanteActual } from "@/lib/registro-servidor";
import { moduloActivo } from "@/lib/modulos";
import type { EstadoFoto } from "@/lib/fotos";

export const dynamic = "force-dynamic";

// Única puerta de entrada a las imágenes: en la nube están en un almacén
// privado, así que se entregan desde aquí y nunca por una URL pública.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ archivo: string }> }
) {
  const { archivo } = await params;
  const noEncontrado = () => NextResponse.json({ error: "no encontrado" }, { status: 404 });
  if (!NOMBRE_VALIDO.test(archivo)) return noEncontrado();
  const foto = await uno<{ evento_id: number; participante_id: number | null; estado: EstadoFoto }>(
    "SELECT evento_id, participante_id, estado FROM photos WHERE archivo = ?", [archivo]
  );
  if (foto) {
    const evento = await uno<Evento>("SELECT * FROM eventos WHERE id = ?", [foto.evento_id]);
    if (!evento) return noEncontrado();
    let permitido = puedeAdministrar(req, evento);
    if (!permitido && foto.participante_id) {
      permitido = (await participanteActual(req, evento))?.id === foto.participante_id;
    }
    if (!permitido) {
      permitido = foto.estado === "aprobada" && moduloActivo(evento, "fotos") &&
        req.nextUrl.searchParams.get("evento") === evento.slug &&
        tokenPantallaValido(evento, req.nextUrl.searchParams.get("k") ?? "");
    }
    if (!permitido) return noEncontrado();
  } else {
    // Banners, planos, fotos de las zonas del mapa, alternativas de votación y
    // de trivia, actividades de la agenda y premios de sorteos son parte del
    // sitio público. Una imagen sin referencias solo se sirve a una sesión del
    // panel. Las listas en JSON se buscan por el nombre, que es único.
    const referencia = await uno<{ id: number }>(
      `SELECT id FROM eventos
        WHERE banner = ?1 OR banner_movil = ?1 OR mapa = ?1 OR instr(mapa_config, ?1) > 0
       UNION ALL
       SELECT v.evento_id AS id FROM votacion_opciones o
         JOIN votaciones v ON v.id = o.votacion_id WHERE o.imagen = ?1
       UNION ALL
       SELECT evento_id AS id FROM agenda WHERE imagen = ?1
       UNION ALL
       SELECT evento_id AS id FROM sorteos WHERE imagen = ?1
       UNION ALL
       SELECT t.evento_id AS id FROM trivia_preguntas p
         JOIN trivias t ON t.id = p.trivia_id WHERE instr(p.imagenes, ?1) > 0
       LIMIT 1`,
      [archivo]
    );
    if (!referencia && !isAdmin(req) && !(await eventoDeSesion(req))) return noEncontrado();
  }
  const imagen = await leerImagen(archivo);
  if (!imagen) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }
  return new Response(imagen.cuerpo as BodyInit, {
    headers: {
      "Content-Type": imagen.tipo,
      "X-Content-Type-Options": "nosniff",
      // Una foto puede dejar de estar aprobada o cambiar de propietario.
      "Cache-Control": "private, no-store",
    },
  });
}
