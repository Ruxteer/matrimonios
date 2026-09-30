import { NextRequest, NextResponse } from "next/server";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { borrarArchivo, guardarImagen, MAX_BYTES } from "@/lib/archivos";
import { contarFotos, insertarFoto, listarFotos, type EstadoFoto } from "@/lib/fotos";
import { moduloActivo } from "@/lib/modulos";
import { registroConfig } from "@/lib/registro";
import { participanteActual } from "@/lib/registro-servidor";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// Ver la galería completa es del panel; subir es de los invitados.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  return NextResponse.json(await listarFotos(evento.id), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!moduloActivo(evento, "fotos")) {
    return NextResponse.json({ error: "el módulo de fotos está desactivado" }, { status: 404 });
  }
  const config = registroConfig(evento);
  const participante = await participanteActual(req, evento);
  const requiereRegistro = moduloActivo(evento, "registro") && config.fotos_requiere_registro;
  if (requiereRegistro && !participante) {
    return NextResponse.json(
      { error: "Regístrate en este evento para compartir tu foto.", registro_requerido: true },
      { status: 401 }
    );
  }
  const limite = config.fotos_por_participante;
  const errorLimite = `Ya compartiste el máximo de ${limite} ${limite === 1 ? "foto" : "fotos"} permitido para este evento.`;
  if (participante && (await contarFotos(evento.id, participante.id)) >= limite) {
    return NextResponse.json({ error: errorLimite, limite_alcanzado: true }, { status: 409 });
  }
  if (Number(req.headers.get("content-length")) > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "la imagen supera los 4 MB" }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo. Selecciónalo de nuevo." }, { status: 400 });
  }
  const archivo = form.get("file");
  if (archivo instanceof File && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(archivo.type)) {
    return NextResponse.json({ error: "Usa JPG, PNG, WebP o GIF. Si tu foto es HEIC, expórtala como JPG para mostrarla en la pantalla." }, { status: 400 });
  }
  const guardado = await guardarImagen(archivo).catch((error) => {
    console.error("No se pudo almacenar la imagen del evento", error);
    return { ok: false as const, error: "No pudimos guardar la foto. Intenta de nuevo.", almacenamiento: true };
  });
  if (!guardado.ok) {
    return NextResponse.json({ error: guardado.error }, { status: "almacenamiento" in guardado ? 500 : 400 });
  }
  const estado: EstadoFoto = config.fotos_moderacion ? "pendiente" : "aprobada";
  try {
    const insercion = await insertarFoto(evento.id, guardado.archivo, participante?.id ?? null, estado, limite);
    if (!insercion.rowsAffected) {
      await borrarArchivo(guardado.archivo);
      return NextResponse.json({ error: errorLimite, limite_alcanzado: true }, { status: 409 });
    }
    const usadas = participante ? await contarFotos(evento.id, participante.id) : 0;
    return NextResponse.json(
      { ok: true, estado, restantes: participante ? Math.max(0, limite - usadas) : null },
      { status: 201 }
    );
  } catch (error) {
    await borrarArchivo(guardado.archivo);
    console.error("No se pudo guardar la foto del evento", error);
    return NextResponse.json({ error: "No pudimos guardar la foto. Intenta de nuevo." }, { status: 500 });
  }
}
