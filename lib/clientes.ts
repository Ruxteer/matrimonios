import { consultar, ejecutar, uno, type Cliente } from "./db";
import { borrarArchivo } from "./archivos";
import { colorValido } from "./colores";
import { slugify } from "./slug";

// Los eventos se agrupan por cliente (la agencia o marca que los encarga).
// Venito no tiene fila en la tabla: son los eventos con cliente_id = 0, los
// que existían antes de que hubiera clientes y los que vende Venito directo.

export const VENITO: Cliente = {
  id: 0,
  slug: "venito",
  nombre: "Venito",
  color: "#ffa100",
  logo: "/brand/venito-negro-tarjeta.svg",
  created_at: "",
};

export const COLOR_CLIENTE = "#5326b4";

// Las filas de libSQL no son objetos planos: se copian campo a campo antes de
// pasar al JSON o a un componente.
function plano(c: Cliente): Cliente {
  return {
    id: Number(c.id),
    slug: c.slug,
    nombre: c.nombre,
    color: c.color,
    logo: c.logo,
    created_at: c.created_at,
  };
}

/** Venito primero y después los clientes en el orden en que se crearon. */
export async function listarClientes(): Promise<Cliente[]> {
  const filas = await consultar<Cliente>("SELECT * FROM clientes ORDER BY created_at, id");
  return [VENITO, ...filas.map(plano)];
}

export async function getCliente(slug: string): Promise<Cliente | null> {
  if (slug.toLowerCase() === VENITO.slug) return VENITO;
  const fila = await uno<Cliente>("SELECT * FROM clientes WHERE slug = ? COLLATE NOCASE", [slug]);
  return fila ? plano(fila) : null;
}

export async function clientePorId(id: number): Promise<Cliente> {
  if (!id) return VENITO;
  const fila = await uno<Cliente>("SELECT * FROM clientes WHERE id = ?", [id]);
  // Si el cliente se borró a mano en la base, el evento vuelve a verse en Venito.
  return fila ? plano(fila) : VENITO;
}

/** Cuántos eventos tiene cada cliente, por id (0 = Venito). */
export async function eventosPorCliente(): Promise<Map<number, number>> {
  const filas = await consultar<{ cliente_id: number; total: number }>(
    `SELECT e.cliente_id AS cliente_id, COUNT(*) AS total FROM eventos e GROUP BY e.cliente_id`
  );
  return new Map(filas.map((f) => [Number(f.cliente_id), Number(f.total)]));
}

async function slugLibre(base: string): Promise<string> {
  const raiz = base || "cliente";
  let slug = raiz;
  for (let n = 2; ; n++) {
    const tomado =
      slug === VENITO.slug ||
      (await uno<{ id: number }>("SELECT id FROM clientes WHERE slug = ? COLLATE NOCASE", [slug]));
    if (!tomado) return slug;
    slug = `${raiz}-${n}`;
  }
}

/** El logo es un archivo subido por el panel; nada de URLs de afuera. */
function logoValido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (v === "" || /^[a-f0-9]{20}\.[a-z]{3,4}$/.test(v)) return v;
  return null;
}

export async function crearCliente(datos: {
  nombre: string;
  color?: unknown;
  logo?: unknown;
}): Promise<Cliente> {
  const nombre = datos.nombre.trim().slice(0, 80);
  const slug = await slugLibre(slugify(nombre));
  const res = await ejecutar(
    "INSERT INTO clientes (slug, nombre, color, logo) VALUES (?, ?, ?, ?)",
    [
      slug,
      nombre,
      colorValido(datos.color) ? datos.color.toLowerCase() : COLOR_CLIENTE,
      logoValido(datos.logo) ?? "",
    ]
  );
  return (await clientePorId(Number(res.lastInsertRowid)))!;
}

export async function actualizarCliente(
  cliente: Cliente,
  body: Record<string, unknown>
): Promise<Cliente> {
  const sets: string[] = [];
  const valores: string[] = [];
  const nombre = typeof body.nombre === "string" ? body.nombre.trim().slice(0, 80) : "";
  if (nombre) {
    sets.push("nombre = ?");
    valores.push(nombre);
  }
  if (colorValido(body.color)) {
    sets.push("color = ?");
    valores.push(body.color.toLowerCase());
  }
  const logo = "logo" in body ? logoValido(body.logo) : null;
  if (logo !== null) {
    sets.push("logo = ?");
    valores.push(logo);
  }
  if (sets.length) {
    await ejecutar(`UPDATE clientes SET ${sets.join(", ")} WHERE id = ?`, [...valores, cliente.id]);
  }
  // El logo reemplazado ya no lo usa nadie.
  if (logo !== null && cliente.logo && cliente.logo !== logo) await borrarArchivo(cliente.logo);
  return clientePorId(cliente.id);
}

/** Borra el cliente; sus eventos no se pierden, pasan a Venito. */
export async function eliminarCliente(cliente: Cliente) {
  await ejecutar("UPDATE eventos SET cliente_id = 0 WHERE cliente_id = ?", [cliente.id]);
  await ejecutar("DELETE FROM clientes WHERE id = ?", [cliente.id]);
  await borrarArchivo(cliente.logo);
}
