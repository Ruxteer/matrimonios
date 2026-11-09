import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, newToken, uno, Guest } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  // ?eliminados=1 entrega el historial de los que se sacaron de la lista, del
  // más reciente al más antiguo; sin él, la lista vigente.
  if (req.nextUrl.searchParams.get("eliminados") === "1") {
    return NextResponse.json(
      await consultar<Guest>(
        "SELECT * FROM guests WHERE evento_id = ? AND eliminado_at <> '' ORDER BY eliminado_at DESC, id DESC",
        [evento.id]
      )
    );
  }
  const guests = await consultar<Guest>(
    "SELECT * FROM guests WHERE evento_id = ? AND eliminado_at = '' ORDER BY nombre COLLATE NOCASE",
    [evento.id]
  );
  return NextResponse.json(guests);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();
  const body = await req.json().catch(() => null);
  if (!String(body?.nombre ?? "").trim()) {
    return NextResponse.json({ error: "El nombre es requerido." }, { status: 400 });
  }
  const result = await ejecutar(
    `INSERT INTO guests (evento_id, nombre, telefono, email, grupo, mesa, cupos, token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evento.id,
      String(body.nombre).trim().slice(0, 200),
      String(body.telefono ?? "").trim().slice(0, 60),
      String(body.email ?? "").trim().slice(0, 200),
      String(body.grupo ?? "").trim().slice(0, 120),
      String(body.mesa ?? "").trim().slice(0, 60),
      Number(body.cupos ?? 1) || 1,
      newToken(),
    ]
  );
  const guest = await uno<Guest>("SELECT * FROM guests WHERE id = ?", [
    Number(result.lastInsertRowid),
  ]);
  return NextResponse.json(guest, { status: 201 });
}
