import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import { registroConfig } from "@/lib/registro";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// Leer todos los mensajes es del panel; dejarlos (POST) es de los invitados.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const messages = await consultar(
    "SELECT * FROM messages WHERE evento_id = ? ORDER BY created_at DESC, id DESC",
    [evento.id]
  );
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim();
  const mensaje = String(body?.mensaje ?? "").trim().slice(0, 300);
  if (!nombre || !mensaje) {
    return NextResponse.json(
      { error: "nombre y mensaje son requeridos" },
      { status: 400 }
    );
  }
  // Con aprobación, el mensaje espera en el panel antes de salir en la pantalla.
  const estado = registroConfig(evento).mensajes_moderacion ? "pendiente" : "aprobada";
  await ejecutar("INSERT INTO messages (evento_id, nombre, mensaje, estado) VALUES (?, ?, ?, ?)", [
    evento.id,
    nombre,
    mensaje,
    estado,
  ]);
  return NextResponse.json({ ok: true, estado }, { status: 201 });
}

// Al pasar a publicación automática, los que quedaron esperando se pueden
// aprobar todos de una vez.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const body = await req.json().catch(() => null);
  if (body?.accion !== "aprobar_pendientes") {
    return NextResponse.json({ error: "acción desconocida" }, { status: 400 });
  }
  const res = await ejecutar(
    "UPDATE messages SET estado = 'aprobada' WHERE evento_id = ? AND estado = 'pendiente'",
    [evento.id]
  );
  return NextResponse.json({ aprobadas: res.rowsAffected });
}
