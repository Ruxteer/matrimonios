import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ejecutar, uno, type Sorteo } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";
import {
  ganadoresAnteriores,
  participantesDeSorteo,
  type Resultado,
} from "@/lib/sorteos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Ejecutar de nuevo reemplaza el resultado anterior: el sorteo guarda solo lo
// último que salió, con la hora en que se hizo y entre cuántos.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const evento = await getEvento(slug);
  if (!evento) return NextResponse.json({ error: "no existe" }, { status: 404 });
  if (!puedeAdministrar(req, evento)) return noAutorizado();

  const sorteo = await uno<Sorteo>(
    "SELECT * FROM sorteos WHERE id = ? AND evento_id = ?",
    [Number(id), evento.id]
  );
  if (!sorteo) {
    return NextResponse.json({ error: "sorteo no encontrado" }, { status: 404 });
  }

  const todos = await participantesDeSorteo(sorteo, evento.id);
  const anteriores = sorteo.excluir_anteriores
    ? await ganadoresAnteriores(evento.id, sorteo.id)
    : null;
  const candidatos = anteriores ? todos.filter((p) => !anteriores.yaGano(p)) : todos;

  if (!candidatos.length) {
    return NextResponse.json(
      {
        error:
          todos.length && anteriores?.alguno
            ? "No queda nadie por sortear: todos ya ganaron en otro sorteo."
            : sorteo.fuente === "base"
              ? "La base no tiene participantes con nombre. Revisa qué columna tiene el nombre."
              : "No hay participantes en la fuente elegida.",
      },
      { status: 400 }
    );
  }
  if (candidatos.length < sorteo.cantidad) {
    return NextResponse.json(
      {
        error:
          `Hay ${candidatos.length} participantes disponibles y el sorteo ` +
          `reparte ${sorteo.cantidad} premios.`,
      },
      { status: 400 }
    );
  }

  // Fisher-Yates con crypto.randomInt: el azar del sorteo tiene que poder
  // defenderse frente a los participantes, y Math.random no da esa garantía.
  const bombo = [...candidatos];
  for (let i = bombo.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [bombo[i], bombo[j]] = [bombo[j], bombo[i]];
  }
  const ganadores = bombo.slice(0, sorteo.cantidad);
  // Los suplentes salen del mismo bombo, después de los ganadores. Si no alcanza
  // para todos, se sacan los que haya.
  const suplentes = bombo.slice(sorteo.cantidad, sorteo.cantidad + sorteo.cantidad_suplentes);

  const detalle: Resultado[] = [
    ...ganadores.map((p, i) => ({ ...p, suplente: false, orden: i + 1 })),
    ...suplentes.map((p, i) => ({ ...p, suplente: true, orden: i + 1 })),
  ];

  await ejecutar(
    `UPDATE sorteos SET ganadores = ?, suplentes = ?, detalle = ?, disponibles = ?,
                        ejecutado_at = datetime('now')
      WHERE id = ? AND evento_id = ?`,
    [
      JSON.stringify(ganadores.map((p) => p.nombre)),
      JSON.stringify(suplentes.map((p) => p.nombre)),
      JSON.stringify(detalle),
      candidatos.length,
      sorteo.id,
      evento.id,
    ]
  );
  const actualizado = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ?", [sorteo.id]);
  return NextResponse.json({ ...actualizado, disponibles: candidatos.length });
}
