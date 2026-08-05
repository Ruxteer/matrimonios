import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { consultar, ejecutar, uno, type Sorteo } from "@/lib/db";
import { noAutorizado, puedeAdministrar } from "@/lib/auth";
import { getEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const clave = (nombre: string) => nombre.trim().toLowerCase();

function leerGanadores(json: string): string[] {
  try {
    const valor = JSON.parse(json || "[]");
    return Array.isArray(valor)
      ? valor.filter((n): n is string => typeof n === "string")
      : [];
  } catch {
    return [];
  }
}

// Quiénes entran al bombo. No existe la fuente "fotos" del documento porque la
// tabla photos no guarda quién subió cada imagen.
async function participantes(sorteo: Sorteo, evento_id: number): Promise<string[]> {
  if (sorteo.fuente === "lista") {
    return sorteo.lista.split("\n").map((l) => l.trim());
  }
  if (sorteo.fuente === "mensajes") {
    const filas = await consultar<{ nombre: string }>(
      `SELECT DISTINCT TRIM(nombre) AS nombre FROM messages
        WHERE evento_id = ? AND TRIM(nombre) <> '' ORDER BY nombre`,
      [evento_id]
    );
    return filas.map((f) => f.nombre);
  }
  const filas = await consultar<{ nombre: string }>(
    `SELECT DISTINCT TRIM(nombre) AS nombre FROM guests
      WHERE evento_id = ? AND TRIM(nombre) <> '' ORDER BY nombre`,
    [evento_id]
  );
  return filas.map((f) => f.nombre);
}

// Ejecutar de nuevo reemplaza el resultado anterior: el sorteo guarda solo lo
// último que salió, con la hora en que se hizo.
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

  const excluidos = new Set<string>();
  if (sorteo.excluir_anteriores) {
    const otros = await consultar<{ ganadores: string }>(
      "SELECT ganadores FROM sorteos WHERE evento_id = ? AND id <> ? AND ganadores <> ''",
      [evento.id, sorteo.id]
    );
    for (const otro of otros) {
      for (const nombre of leerGanadores(otro.ganadores)) excluidos.add(clave(nombre));
    }
  }

  const candidatos: string[] = [];
  const vistos = new Set<string>();
  for (const nombre of await participantes(sorteo, evento.id)) {
    const k = clave(nombre);
    if (!k || vistos.has(k) || excluidos.has(k)) continue;
    vistos.add(k);
    candidatos.push(nombre.trim());
  }

  if (!candidatos.length) {
    return NextResponse.json(
      {
        error: excluidos.size
          ? "No queda nadie por sortear: todos ya ganaron en otro sorteo."
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
  // defenderse frente a los invitados, y Math.random no da esa garantía.
  const bombo = [...candidatos];
  for (let i = bombo.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [bombo[i], bombo[j]] = [bombo[j], bombo[i]];
  }
  const ganadores = bombo.slice(0, sorteo.cantidad);

  await ejecutar(
    `UPDATE sorteos SET ganadores = ?, ejecutado_at = datetime('now')
      WHERE id = ? AND evento_id = ?`,
    [JSON.stringify(ganadores), sorteo.id, evento.id]
  );
  const actualizado = await uno<Sorteo>("SELECT * FROM sorteos WHERE id = ?", [
    sorteo.id,
  ]);
  // `disponibles` es entre cuántos salió: no es lo mismo que el total de la
  // fuente cuando se excluye a los que ya ganaron.
  return NextResponse.json({ ...actualizado, disponibles: candidatos.length });
}
