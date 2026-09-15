"use client";

import { useCallback, useEffect, useState } from "react";
import type { Sorteo } from "@/lib/db";
import type { Resultado } from "@/lib/sorteos";

type SorteoAdmin = Sorteo & {
  participantes: number;
  base: { filas: number; muestra: Record<string, string>[] } | null;
};

// El documento del módulo también menciona sortear entre quienes subieron
// fotos, pero la tabla photos no guarda quién subió cada imagen.
const FUENTES = [
  { valor: "invitados", label: "Todos los invitados" },
  { valor: "mensajes", label: "Quienes dejaron un mensaje" },
  { valor: "lista", label: "Una lista escrita aquí" },
  { valor: "base", label: "Una base de datos (Excel o CSV)" },
];

// ejecutado_at viene de SQLite en UTC y sin zona horaria.
function hora(ejecutado_at: string): string {
  if (!ejecutado_at) return "";
  return new Date(`${ejecutado_at.replace(" ", "T")}Z`).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function leerJson<T>(json: string, porDefecto: T): T {
  try {
    const valor = JSON.parse(json || "null");
    return valor ?? porDefecto;
  } catch {
    return porDefecto;
  }
}

const miles = (n: number) => n.toLocaleString("es-CL");

export default function Sorteos({ slug }: { slug: string }) {
  const [sorteos, setSorteos] = useState<SorteoAdmin[]>([]);
  const [estado, setEstado] = useState("");

  const cargar = useCallback(() => {
    fetch(`/api/eventos/${slug}/sorteos`).then(async (res) => {
      if (res.ok) setSorteos(await res.json());
    });
  }, [slug]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear() {
    const titulo = prompt("¿Cómo se llama el sorteo?");
    if (!titulo?.trim()) return;
    const res = await fetch(`/api/eventos/${slug}/sorteos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    });
    if (!res.ok) {
      setEstado("No pudimos crear el sorteo.");
      return;
    }
    setEstado("Sorteo creado: completa el premio y quiénes participan.");
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={crear}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          Nuevo sorteo
        </button>
        <p className="text-sm text-neutral-500">
          Los sorteos publicados se ven en /{slug}/sorteo. Los ganadores aparecen
          recién cuando ejecutas el sorteo.
        </p>
      </div>

      {sorteos.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no hay sorteos.</p>
      ) : (
        sorteos.map((sorteo) => (
          <Ficha
            key={sorteo.id}
            slug={slug}
            sorteo={sorteo}
            recargar={cargar}
            avisar={setEstado}
          />
        ))
      )}

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}
    </div>
  );
}

function Ficha({
  slug,
  sorteo,
  recargar,
  avisar,
}: {
  slug: string;
  sorteo: SorteoAdmin;
  recargar: () => void;
  avisar: (mensaje: string) => void;
}) {
  const [form, setForm] = useState(sorteo);
  const [ocupado, setOcupado] = useState(false);
  const url = `/api/eventos/${slug}/sorteos/${sorteo.id}`;

  const ganadores = leerJson<string[]>(sorteo.ganadores, []);
  const detalle = leerJson<Resultado[]>(sorteo.detalle, []);
  // El total de participantes lo calcula el servidor, así que mientras haya
  // cambios sin guardar el número de pantalla no corresponde.
  const sinGuardar = form.fuente !== sorteo.fuente || form.lista !== sorteo.lista;
  // Sortear con cambios sin guardar usaría la cantidad o las reglas anteriores:
  // en vivo, frente a todos, eso no tiene arreglo.
  const hayCambios =
    sinGuardar ||
    (["titulo", "premio", "cantidad", "cantidad_suplentes", "excluir_anteriores", "publicado"] as const)
      .some((campo) => form[campo] !== sorteo[campo]);

  async function guardar() {
    setOcupado(true);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: form.titulo,
        premio: form.premio,
        fuente: form.fuente,
        lista: form.lista,
        cantidad: form.cantidad,
        cantidad_suplentes: form.cantidad_suplentes,
        excluir_anteriores: form.excluir_anteriores,
        publicado: form.publicado,
      }),
    });
    setOcupado(false);
    avisar(res.ok ? "Sorteo guardado" : "No pudimos guardar el sorteo.");
    if (res.ok) recargar();
  }

  async function ejecutar() {
    if (
      ganadores.length > 0 &&
      !confirm(
        `"${sorteo.titulo}" ya tiene ganadores. Volver a ejecutarlo los reemplaza. ¿Seguir?`
      )
    ) {
      return;
    }
    setOcupado(true);
    const res = await fetch(`${url}/ejecutar`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setOcupado(false);
    if (!res.ok) {
      avisar(data?.error ?? "No pudimos ejecutar el sorteo.");
      return;
    }
    avisar(`Sorteo ejecutado entre ${miles(data.disponibles)} participantes.`);
    recargar();
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar el sorteo "${sorteo.titulo}"? También se borran sus ganadores.`))
      return;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      avisar("No pudimos eliminar el sorteo.");
      return;
    }
    avisar("Sorteo eliminado");
    recargar();
  }

  return (
    <section className="space-y-3 rounded-xl border border-neutral-200 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Nombre del sorteo</span>
          <input
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Premio</span>
          <input
            value={form.premio}
            onChange={(e) => setForm({ ...form, premio: e.target.value })}
            placeholder="Una noche en el hotel"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-neutral-500">Participan</span>
          <select
            value={form.fuente}
            onChange={(e) =>
              setForm({ ...form, fuente: e.target.value as Sorteo["fuente"] })
            }
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          >
            {FUENTES.map(({ valor, label }) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Ganadores</span>
          <input
            type="number"
            min={1}
            max={50}
            value={form.cantidad}
            onChange={(e) => setForm({ ...form, cantidad: Number(e.target.value) || 1 })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500" title="Por si un ganador no está">
            Suplentes
          </span>
          <input
            type="number"
            min={0}
            max={20}
            value={form.cantidad_suplentes}
            onChange={(e) =>
              setForm({ ...form, cantidad_suplentes: Math.max(0, Number(e.target.value) || 0) })
            }
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.excluir_anteriores === 1}
            onChange={(e) =>
              setForm({ ...form, excluir_anteriores: e.target.checked ? 1 : 0 })
            }
          />
          No repetir quien ya ganó
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.publicado === 1}
            onChange={(e) => setForm({ ...form, publicado: e.target.checked ? 1 : 0 })}
          />
          Mostrarlo en la web
        </label>
      </div>

      {form.fuente === "lista" && (
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">
            Los participantes, un nombre por línea
          </span>
          <textarea
            value={form.lista}
            onChange={(e) => setForm({ ...form, lista: e.target.value })}
            rows={5}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
          />
        </label>
      )}

      {form.fuente === "base" && (
        <BaseImportada
          url={url}
          sorteo={sorteo}
          recargar={recargar}
          avisar={avisar}
        />
      )}

      <p className="text-sm text-neutral-500">
        {sinGuardar
          ? "Guarda para saber cuántos participan."
          : `${miles(sorteo.participantes)} participantes en esta fuente.`}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={guardar}
          disabled={ocupado}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          onClick={ejecutar}
          disabled={ocupado || hayCambios}
          title={hayCambios ? "Guarda primero los cambios" : undefined}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          {ganadores.length > 0 ? "Sortear de nuevo" : "Ejecutar sorteo"}
        </button>
        <button
          onClick={eliminar}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
        >
          Eliminar
        </button>
      </div>

      {ganadores.length > 0 && (
        <Resultados sorteo={sorteo} ganadores={ganadores} detalle={detalle} url={url} />
      )}
    </section>
  );
}

// La base se sube y sus columnas se eligen al instante, sin pasar por
// "Guardar": son decisiones sobre el archivo, no sobre el sorteo.
function BaseImportada({
  url,
  sorteo,
  recargar,
  avisar,
}: {
  url: string;
  sorteo: SorteoAdmin;
  recargar: () => void;
  avisar: (mensaje: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const columnas = leerJson<string[]>(sorteo.columnas, []);
  const elegidas = [sorteo.columna_nombre, sorteo.columna_apellido, sorteo.columna_clave];

  async function subir(archivo: File) {
    setSubiendo(true);
    avisar(`Leyendo ${archivo.name}…`);
    const datos = new FormData();
    datos.append("file", archivo);
    const res = await fetch(`${url}/base`, { method: "POST", body: datos });
    const data = await res.json().catch(() => null);
    setSubiendo(false);
    if (!res.ok) {
      avisar(data?.error ?? "No pudimos cargar la base.");
      return;
    }
    avisar(
      `Base cargada: ${miles(data.filas)} filas. Revisa que las columnas elegidas sean las correctas.`
    );
    recargar();
  }

  async function elegir(campo: string, valor: string) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: valor }),
    });
    if (res.ok) recargar();
    else avisar("No pudimos cambiar la columna.");
  }

  async function quitar() {
    if (!confirm("¿Quitar la base? Se borran todas sus filas de Venito.")) return;
    const res = await fetch(`${url}/base`, { method: "DELETE" });
    avisar(res.ok ? "Base quitada" : "No pudimos quitar la base.");
    if (res.ok) recargar();
  }

  const botonSubir = (texto: string) => (
    <label
      className={`cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 ${
        subiendo ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {subiendo ? "Cargando…" : texto}
      <input
        type="file"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) subir(f);
          e.target.value = "";
        }}
      />
    </label>
  );

  if (!sorteo.base_nombre) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm">
        <p className="mb-1 font-medium">Sube la base de participantes</p>
        <p className="mb-3 text-neutral-500">
          Una planilla .xlsx o .csv con los títulos de las columnas en la primera fila.
          Sirve cualquier formato: nosotros buscamos la columna del nombre y, si viene,
          la del RUT o el correo para no contar dos veces a la misma persona. Hasta
          20.000 filas y 4 MB.
        </p>
        {botonSubir("Elegir archivo")}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg bg-neutral-50 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p>
          <span className="font-medium">{sorteo.base_nombre}</span>
          <span className="text-neutral-500">
            {" "}
            · {miles(sorteo.base?.filas ?? 0)} filas · {columnas.length} columnas
          </span>
        </p>
        <div className="ml-auto flex gap-2">
          {botonSubir("Reemplazar")}
          <button
            onClick={quitar}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-neutral-500 hover:bg-white"
          >
            Quitar
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="mb-1 block text-neutral-500">El nombre está en</span>
          <select
            value={sorteo.columna_nombre}
            onChange={(e) => elegir("columna_nombre", e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          >
            {columnas.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-neutral-500">El apellido, si va aparte</span>
          <select
            value={sorteo.columna_apellido}
            onChange={(e) => elegir("columna_apellido", e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          >
            <option value="">No hay columna aparte</option>
            {columnas.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-neutral-500">Distingue a cada persona</span>
          <select
            value={sorteo.columna_clave}
            onChange={(e) => elegir("columna_clave", e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          >
            <option value="">El nombre</option>
            {columnas.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-neutral-500">
        Dos filas con el mismo {sorteo.columna_clave || "nombre"} cuentan como una sola
        persona. {sorteo.columna_clave ? "" : "Si la base trae RUT o correo, elígelo: así dos personas que se llaman igual participan las dos."}
      </p>

      {sorteo.base && sorteo.base.muestra.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {columnas.map((c) => (
                  <th
                    key={c}
                    className={`whitespace-nowrap px-3 py-2 font-medium ${
                      elegidas.includes(c) ? "bg-neutral-900 text-white" : "text-neutral-500"
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorteo.base.muestra.map((fila, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  {columnas.map((c) => (
                    <td key={c} className="max-w-[16rem] truncate whitespace-nowrap px-3 py-1.5">
                      {fila[c]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {sorteo.base.filas > sorteo.base.muestra.length && (
            <p className="border-t border-neutral-100 px-3 py-1.5 text-xs text-neutral-400">
              Primeras {sorteo.base.muestra.length} de {miles(sorteo.base.filas)} filas
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Un ganador con lo que traía la base para ubicarlo (RUT, correo, empresa…),
// menos el nombre y el apellido, que ya van arriba.
function Persona({ r, sorteo }: { r: Resultado; sorteo: SorteoAdmin }) {
  const extra = Object.entries(r.datos ?? {}).filter(
    ([col, valor]) => valor && col !== sorteo.columna_nombre && col !== sorteo.columna_apellido
  );
  return (
    <li>
      <p className={r.suplente ? "text-sm" : "text-sm font-medium"}>
        {r.suplente && <span className="text-neutral-400">{r.orden}. </span>}
        {r.nombre}
      </p>
      {extra.length > 0 && (
        <p className="text-xs text-neutral-500">
          {extra.map(([col, valor]) => `${col}: ${valor}`).join(" · ")}
        </p>
      )}
    </li>
  );
}

function Resultados({
  sorteo,
  ganadores,
  detalle,
  url,
}: {
  sorteo: SorteoAdmin;
  ganadores: string[];
  detalle: Resultado[];
  url: string;
}) {
  // Sorteos ejecutados antes de existir el detalle: solo quedan los nombres.
  const filas: Resultado[] = detalle.length
    ? detalle
    : ganadores.map((nombre, i) => ({ nombre, clave: "", suplente: false, orden: i + 1 }));
  const titulares = filas.filter((r) => !r.suplente);
  const suplentes = filas.filter((r) => r.suplente);

  return (
    <div className="rounded-lg bg-neutral-100 p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xs text-neutral-500">
          Ganadores del {hora(sorteo.ejecutado_at)}
          {sorteo.disponibles > 0 && ` · entre ${miles(sorteo.disponibles)} personas`}
        </p>
        <div className="ml-auto flex gap-3 text-xs">
          <a href={`${url}/acta`} className="underline hover:text-neutral-900">
            Descargar acta (Excel)
          </a>
          <a href={`${url}/acta?formato=csv`} className="underline hover:text-neutral-900">
            CSV
          </a>
        </div>
      </div>
      <ul className="mt-2 space-y-1.5">
        {titulares.map((r) => (
          <Persona key={`g${r.orden}`} r={r} sorteo={sorteo} />
        ))}
      </ul>
      {suplentes.length > 0 && (
        <>
          <p className="mt-3 text-xs text-neutral-500">
            Suplentes, en orden: si un ganador no está, pasa el siguiente
          </p>
          <ul className="mt-1 space-y-1">
            {suplentes.map((r) => (
              <Persona key={`s${r.orden}`} r={r} sorteo={sorteo} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
