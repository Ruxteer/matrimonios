import { NextRequest, NextResponse } from "next/server";
import { ejecutar, uno, type Sorteo } from "@/lib/db";
import { getEvento } from "@/lib/eventos";
import { moduloActivo } from "@/lib/modulos";
import { claveDe, inscripcionAbierta } from "@/lib/sorteos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Inscripción a un sorteo desde el QR de la pantalla: nombre y correo. El
// correo distingue a cada persona, así que inscribirse dos veces no suma
// otra oportunidad.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento || !moduloActivo(evento, "sorteos")) {
    return NextResponse.json({ error: "no existe" }, { status: 404 });
  }
  const sorteo = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ? AND evento_id = ?", [
    Number(id),
    evento.id,
  ]);
  if (!sorteo || sorteo.fuente !== "inscritos") {
    return NextResponse.json({ error: "Este sorteo no recibe inscripciones." }, { status: 404 });
  }
  if (!inscripcionAbierta(sorteo)) {
    return NextResponse.json(
      { error: sorteo.ejecutado_at ? "Este sorteo ya se realizó." : "Las inscripciones ya cerraron." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const email = String(body?.email ?? "").trim().slice(0, 200);
  if (nombre.length < 2) return NextResponse.json({ error: "Escribe tu nombre para participar." }, { status: 400 });
  if (!CORREO.test(email)) return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });

  const res = await ejecutar(
    `INSERT INTO sorteo_inscritos (sorteo_id, nombre, email, email_normalizado)
     VALUES (?, ?, ?, ?) ON CONFLICT (sorteo_id, email_normalizado) DO NOTHING`,
    [sorteo.id, nombre, email.toLowerCase(), claveDe(email)]
  );
  return NextResponse.json({ ok: true, repetido: res.rowsAffected === 0 }, { status: res.rowsAffected ? 201 : 200 });
}
