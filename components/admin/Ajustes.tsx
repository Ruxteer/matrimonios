"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { urlArchivo } from "@/lib/urls";
import type { EventoPanel } from "@/lib/eventos";
import Paleta from "./Paleta";
import { etiquetaEvento } from "@/lib/identidad";
import { DISENO_CAROZZI } from "@/lib/config";
import type { Cliente } from "@/lib/db";

const MODOS = [
  { valor: "todo", label: "Fotos y mensajes" },
  { valor: "fotos", label: "Solo fotos" },
  { valor: "mensajes", label: "Solo mensajes" },
];

// Una clave fácil de dictar por teléfono: dos palabras y un número.
const PALABRAS = [
  "evento", "equipo", "pista", "carrera", "cumbre", "viento", "bosque",
  "nube", "gente", "azul", "ruta", "luz",
];

function claveSugerida(): string {
  const azar = (n: number) => Math.floor(Math.random() * n);
  return `${PALABRAS[azar(PALABRAS.length)]}-${PALABRAS[azar(PALABRAS.length)]}-${100 + azar(900)}`;
}

export default function Ajustes({
  evento,
  onGuardado,
}: {
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(evento);
  const [estado, setEstado] = useState("");
  const [subiendo, setSubiendo] = useState("");
  const [modo, setModo] = useState(evento.tipo === "activacion" ? "fotos" : "todo");
  const [oscuro, setOscuro] = useState(false);
  const [claveNueva, setClaveNueva] = useState("");
  const [disenoPendiente, setDisenoPendiente] = useState(false);
  // De qué cliente es el evento: solo lo ve y lo cambia la clave maestra.
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSlug, setClienteSlug] = useState(evento.cliente?.slug ?? "venito");

  useEffect(() => {
    if (!evento.maestra) return;
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
  }, [evento.maestra]);

  const origen = typeof window !== "undefined" ? window.location.origin : "";
  const urlPublica = `${origen}/${evento.slug}`;
  const urlPantalla =
    `${origen}/pantalla/${evento.slug}?k=${form.pantalla_token}` +
    (modo === "todo" ? "" : `&modo=${modo}`) +
    (oscuro ? "&fondo=oscuro" : "");

  function recibirEvento(actualizado: EventoPanel, guardaDiseno = false) {
    // Los cambios de clave, imagen o color pueden llegar mientras se revisa el preset.
    // Conserva sus textos y banners hasta que se pulse Guardar datos.
    setForm((anterior) => disenoPendiente && !guardaDiseno ? {
      ...actualizado,
      titulo: anterior.titulo, descripcion: anterior.descripcion, fecha: anterior.fecha,
      banner: anterior.banner, banner_movil: anterior.banner_movil, banner_texto: anterior.banner_texto,
    } : actualizado);
    onGuardado(actualizado);
    if (guardaDiseno) setDisenoPendiente(false);
  }

  async function nuevaClave() {
    if (!confirm("El enlace actual de la pantalla dejará de funcionar. ¿Seguir?")) return;
    const res = await fetch(`/api/eventos/${evento.slug}/pantalla`, { method: "POST" });
    if (!res.ok) {
      setEstado("No pudimos cambiar la clave.");
      return;
    }
    const actualizado: EventoPanel = await res.json();
    recibirEvento(actualizado);
    setEstado("Clave nueva: el enlace anterior ya no sirve.");
  }

  async function guardar(cambios: Record<string, unknown>, mensaje = "Guardado") {
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${evento.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    if (!res.ok) {
      setEstado("No pudimos guardar los cambios.");
      return;
    }
    const actualizado: EventoPanel = await res.json();
    recibirEvento(actualizado, disenoPendiente && "tipo" in cambios && "banner" in cambios);
    setEstado(mensaje);
    if (actualizado.slug !== evento.slug) router.replace(`/admin/${actualizado.slug}`);
  }

  // La clave viaja para guardarse como hash; el panel nunca la recibe de vuelta.
  async function cambiarClaveOrganizador(clave: string) {
    if (!clave && !confirm("Los organizadores dejarán de poder entrar a su panel. ¿Seguir?")) {
      return;
    }
    setEstado("Guardando…");
    const res = await fetch(`/api/eventos/${evento.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave }),
    });
    const datos = await res.json();
    if (!res.ok) {
      setEstado(datos.error ?? "No pudimos guardar la clave.");
      return;
    }
    recibirEvento(datos);
    setClaveNueva("");
    setEstado(clave ? "Clave guardada. Anótala, no se puede volver a ver." : "Acceso quitado.");
  }

  async function subir(file: File, destino: "banner" | "banner_movil") {
    setSubiendo(destino);
    const datos = new FormData();
    datos.append("file", file);
    const res = await fetch("/api/archivos", { method: "POST", body: datos });
    const data = await res.json();
    setSubiendo("");
    if (!res.ok) {
      setEstado(data.error ?? "No pudimos subir la imagen.");
      return;
    }
    await guardar({ [destino]: data.archivo }, "Imagen actualizada");
  }

  async function eliminar() {
    if (
      !confirm(
        `¿Eliminar ${etiquetaEvento(evento)}? ` +
          "Se borran sus participantes, mensajes y fotos. Esto no se puede deshacer."
      )
    )
      return;
    const res = await fetch(`/api/eventos/${evento.slug}`, { method: "DELETE" });
    if (res.ok) router.push(evento.cliente ? `/admin/clientes/${evento.cliente.slug}` : "/admin");
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-medium">Datos del evento</h2>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block">Tipo de experiencia</span>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as EventoPanel["tipo"] })} className="w-full rounded-lg border border-neutral-300 px-3 py-2">
            <option value="matrimonio">Matrimonio</option>
            <option value="activacion">Activación de marca o evento</option>
          </select>
        </label>
        {form.tipo === "activacion" && <div className="mb-4 space-y-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
            <p className="text-sm font-medium">Diseño Corrida Carozzi</p>
            <p className="mt-1 text-xs leading-relaxed">Banner de la corrida y paleta deportiva según la referencia visual de la propuesta.</p>
            <button type="button" onClick={() => { setForm({ ...form, ...DISENO_CAROZZI }); setDisenoPendiente(true); }} className="mt-3 rounded-full bg-[#1e70bb] px-4 py-2 text-sm font-medium text-white hover:bg-[#195f9e]">Usar diseño Corrida Carozzi</button>
            {disenoPendiente && <p role="status" className="mt-3 text-xs">Diseño preparado. Guarda los datos para aplicarlo.</p>}
          </div>
          <label className="block text-sm">Nombre del evento
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <label className="block text-sm">Mensaje de bienvenida
            <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" rows={3} />
          </label>
        </div>}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={`text-sm ${form.tipo === "activacion" ? "hidden" : ""}`}>
            <span className="mb-1 block text-neutral-500">Novia</span>
            <input
              value={form.nombre1}
              onChange={(e) => setForm({ ...form, nombre1: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className={`text-sm ${form.tipo === "activacion" ? "hidden" : ""}`}>
            <span className="mb-1 block text-neutral-500">Novio</span>
            <input
              value={form.nombre2}
              onChange={(e) => setForm({ ...form, nombre2: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">Fecha (como se muestra)</span>
            <input
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              placeholder="20 · 10 · 2026"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>
        {/* Cambiar la dirección invalida los QR impresos: solo el administrador. */}
        {evento.maestra && (
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-neutral-500">
              Dirección web (cambiarla invalida los QR ya impresos)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">/</span>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 font-mono"
              />
            </div>
          </label>
        )}
        {evento.maestra && clientes.length > 0 && (
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-neutral-500">Cliente</span>
            <select
              value={clienteSlug}
              onChange={(e) => setClienteSlug(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2"
            >
              {clientes.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          onClick={() =>
            guardar({
              tipo: form.tipo,
              titulo: form.titulo,
              descripcion: form.descripcion,
              nombre1: form.nombre1,
              nombre2: form.nombre2,
              fecha: form.fecha,
              ...(disenoPendiente ? {
                banner: form.banner, banner_movil: form.banner_movil, banner_texto: form.banner_texto,
                color_fondo: form.color_fondo, color_rosa: form.color_rosa, color_card: form.color_card,
                color_texto: form.color_texto, color_dorado: form.color_dorado,
              } : {}),
              ...(evento.maestra ? { slug: form.slug } : {}),
              ...(evento.maestra && clienteSlug !== (evento.cliente?.slug ?? "venito")
                ? { cliente: clienteSlug }
                : {}),
            })
          }
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          Guardar datos
        </button>
      </section>

      <section>
        <Paleta
          key={`${form.tipo}-${form.color_fondo}-${form.color_rosa}-${form.color_card}-${form.color_texto}-${form.color_dorado}`}
          evento={form}
          onGuardado={recibirEvento}
        />
      </section>

      <section>
        <h2 className="mb-1 font-medium">Banner</h2>
        <p className="mb-4 text-sm text-neutral-500">
          {form.tipo === "activacion"
            ? "Imagen de la marca o campaña para encabezar la experiencia. Puedes usar otra versión para celular. Sin banner, se muestran el nombre y el mensaje del evento."
            : "Uno para computador y otro para celular, porque la misma imagen no queda bien en las dos proporciones. Si subes uno solo, se usa en ambos. Sin banner, se muestra el marco floral."}
        </p>
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          {(
            [
              {
                campo: "banner",
                titulo: "Computador",
                medida: form.tipo === "activacion" ? "Horizontal, por ejemplo 1600 × 900." : "Apaisado y bajo, por ejemplo 2880 × 400.",
                vista: form.tipo === "activacion" ? "aspect-[16/9]" : "aspect-[36/5]",
              },
              {
                campo: "banner_movil",
                titulo: "Celular",
                medida: form.tipo === "activacion" ? "Imagen principal para celular, por ejemplo 840 × 490." : "Más alto, por ejemplo 1236 × 600.",
                vista: form.tipo === "activacion" ? "aspect-[12/7] max-w-xs" : "aspect-[2/1] max-w-xs",
              },
            ] as const
          ).map(({ campo, titulo, medida, vista }) => {
            const propio = form[campo];
            // Lo que se ve hoy en ese tamaño: el suyo, el del otro tamaño o nada.
            const otro = form[campo === "banner" ? "banner_movil" : "banner"];
            const actual = propio || otro;
            return (
              <div key={campo}>
                <p className="mb-1 text-sm font-medium">{titulo}</p>
                <p className="mb-2 text-xs text-neutral-500">{medida}</p>
                <div
                  className={`mb-2 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 ${vista}`}
                >
                  {actual ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={urlArchivo(actual)}
                      alt={`Banner para ${titulo.toLowerCase()}`}
                      className={`h-full w-full object-cover ${propio ? "" : "opacity-50"}`}
                    />
                  ) : (
                    <p className="flex h-full items-center justify-center text-xs text-neutral-400">
                      Sin banner propio
                    </p>
                  )}
                </div>
                {!propio && otro && (
                  <p className="mb-2 text-xs text-neutral-500">
                    Usando el de {campo === "banner" ? "celular" : "computador"}.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
                    {subiendo === campo ? "Subiendo…" : propio ? "Cambiar" : "Subir"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) subir(f, campo);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {propio && (
                    <button
                      onClick={() => guardar({ [campo]: "" }, "Banner quitado")}
                      className="text-sm text-neutral-500 underline hover:text-neutral-800"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.banner_texto === 1}
            onChange={(e) => guardar({ banner_texto: e.target.checked ? 1 : 0 }, "Listo")}
          />
          Mostrar el nombre y la fecha del evento
        </label>
      </section>

      <section>
        <h2 className="mb-1 font-medium">QR del evento</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Un solo QR para todos los participantes: lleva a {urlPublica}
        </p>
        <div className="flex flex-wrap items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/eventos/${evento.slug}/qr`}
            alt={`QR de ${etiquetaEvento(evento)}`}
            className="h-40 w-40 rounded-lg border border-neutral-200 bg-white p-2"
          />
          <div className="space-y-2 text-sm">
            <a
              href={`/api/eventos/${evento.slug}/qr?descargar=1`}
              download
              className="block rounded-lg border border-neutral-300 px-4 py-2 text-center hover:bg-neutral-50"
            >
              Descargar PNG
            </a>
            <a
              href={`/api/eventos/${evento.slug}/qr?formato=svg&descargar=1`}
              download
              className="block rounded-lg border border-neutral-300 px-4 py-2 text-center hover:bg-neutral-50"
            >
              Descargar SVG (para imprenta)
            </a>
            <button
              onClick={() => navigator.clipboard?.writeText(urlPublica)}
              className="block w-full rounded-lg border border-neutral-300 px-4 py-2 hover:bg-neutral-50"
            >
              Copiar dirección
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-medium">Pantalla en vivo</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Para proyectar en el telón o la pantalla LED: va rotando las fotos aprobadas y los mensajes, y muestra el QR al lado para que se sumen más participantes. El enlace trae
          su propia clave, así que en el computador del evento no hay que escribir la
          contraseña del panel.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {MODOS.map(({ valor, label }) => (
            <button
              key={valor}
              onClick={() => setModo(valor)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                modo === valor
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              {label}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={oscuro}
              onChange={(e) => setOscuro(e.target.checked)}
            />
            Fondo oscuro
          </label>
        </div>
        <p className="mb-3 truncate rounded-lg bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-600">
          {urlPantalla}
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href={urlPantalla}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
          >
            Abrir pantalla ↗
          </a>
          <button
            onClick={() => navigator.clipboard?.writeText(urlPantalla)}
            className="rounded-lg border border-neutral-300 px-4 py-2 hover:bg-neutral-50"
          >
            Copiar enlace
          </button>
          <button
            onClick={nuevaClave}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-neutral-500 hover:bg-neutral-50"
          >
            Cambiar la clave
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-medium">Clave del organizador</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Con esta clave los organizadores entran al panel de este evento: cargan su
          agenda, crean sus votaciones y ven sus fotos, sin ver los demás eventos.
          No pueden cambiar la dirección web ni eliminar el evento.
        </p>
        <p className="mb-3 text-sm">
          {form.tiene_clave ? (
            <span className="text-neutral-700">
              Hay una clave puesta. No se puede ver: si se perdió, pon una nueva.
            </span>
          ) : (
            <span className="text-neutral-500">
              Todavía no tiene clave, así que solo entra el administrador.
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={claveNueva}
            onChange={(e) => setClaveNueva(e.target.value)}
            placeholder="Clave nueva (mínimo 6 caracteres)"
            className="w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => cambiarClaveOrganizador(claveNueva)}
            disabled={claveNueva.trim().length < 6}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-30"
          >
            {form.tiene_clave ? "Cambiar clave" : "Poner clave"}
          </button>
          <button
            onClick={() => setClaveNueva(claveSugerida())}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Sugerir una
          </button>
          {form.tiene_clave && (
            <button
              onClick={() => cambiarClaveOrganizador("")}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
            >
              Quitar el acceso
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Anótala antes de guardar: después no se puede recuperar, solo reemplazar.
        </p>
      </section>

      {evento.maestra && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <h2 className="mb-1 font-medium text-rose-900">Eliminar evento</h2>
          <p className="mb-3 text-sm text-rose-800">
            Borra el evento junto con sus participantes, registros, mensajes y fotos.
          </p>
          <button
            onClick={eliminar}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700"
          >
            Eliminar
          </button>
        </section>
      )}

      {estado && <p role="status" className="sticky bottom-4 rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-700 shadow-sm">{estado}</p>}
    </div>
  );
}
