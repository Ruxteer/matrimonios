"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { urlArchivo } from "@/lib/urls";
import type { EventoPanel } from "@/lib/eventos";
import Paleta from "./Paleta";

const MODOS = [
  { valor: "todo", label: "Fotos y mensajes" },
  { valor: "fotos", label: "Solo fotos" },
  { valor: "mensajes", label: "Solo mensajes" },
];

// Una clave fácil de dictar por teléfono: dos palabras y un número.
const PALABRAS = [
  "anillo", "brindis", "cumbia", "flores", "jardin", "novios", "ramo",
  "tarta", "valses", "abrazo", "fiesta", "sonrisa",
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
  const [modo, setModo] = useState("todo");
  const [oscuro, setOscuro] = useState(false);
  const [claveNueva, setClaveNueva] = useState("");

  const origen = typeof window !== "undefined" ? window.location.origin : "";
  const urlPublica = `${origen}/${evento.slug}`;
  const urlPantalla =
    `${origen}/pantalla/${evento.slug}?k=${form.pantalla_token}` +
    (modo === "todo" ? "" : `&modo=${modo}`) +
    (oscuro ? "&fondo=oscuro" : "");

  async function nuevaClave() {
    if (!confirm("El enlace actual de la pantalla dejará de funcionar. ¿Seguir?")) return;
    const res = await fetch(`/api/eventos/${evento.slug}/pantalla`, { method: "POST" });
    if (!res.ok) {
      setEstado("No pudimos cambiar la clave.");
      return;
    }
    const actualizado: EventoPanel = await res.json();
    setForm(actualizado);
    onGuardado(actualizado);
    setEstado("Clave nueva: el enlace anterior ya no sirve.");
  }

  async function guardar(cambios: Partial<EventoPanel>, mensaje = "Guardado") {
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
    setForm(actualizado);
    onGuardado(actualizado);
    setEstado(mensaje);
    if (actualizado.slug !== evento.slug) router.replace(`/admin/${actualizado.slug}`);
  }

  // La clave viaja para guardarse como hash; el panel nunca la recibe de vuelta.
  async function cambiarClaveNovios(clave: string) {
    if (!clave && !confirm("Los novios dejarán de poder entrar a su panel. ¿Seguir?")) {
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
    setForm(datos);
    onGuardado(datos);
    setClaveNueva("");
    setEstado(clave ? "Clave guardada. Anótala, no se puede volver a ver." : "Acceso quitado.");
  }

  async function subir(file: File, destino: "banner" | "banner_movil" | "mapa") {
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
        `¿Eliminar el matrimonio de ${evento.nombre1} y ${evento.nombre2}? ` +
          "Se borran sus invitados, mensajes y fotos. Esto no se puede deshacer."
      )
    )
      return;
    const res = await fetch(`/api/eventos/${evento.slug}`, { method: "DELETE" });
    if (res.ok) router.push("/admin");
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-medium">Datos del matrimonio</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">Novia</span>
            <input
              value={form.nombre1}
              onChange={(e) => setForm({ ...form, nombre1: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
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
        <button
          onClick={() =>
            guardar({
              nombre1: form.nombre1,
              nombre2: form.nombre2,
              fecha: form.fecha,
              ...(evento.maestra ? { slug: form.slug } : {}),
            })
          }
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          Guardar datos
        </button>
      </section>

      <section>
        <Paleta
          evento={evento}
          onGuardado={(actualizado) => {
            setForm(actualizado);
            onGuardado(actualizado);
          }}
        />
      </section>

      <section>
        <h2 className="mb-1 font-medium">Banner</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Uno para computador y otro para celular, porque la misma imagen no queda
          bien en las dos proporciones. Si subes uno solo, se usa en ambos. Sin
          ninguno se usa el marco floral del producto.
        </p>
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          {(
            [
              {
                campo: "banner",
                titulo: "Computador",
                medida: "Apaisado y bajo, por ejemplo 2880 × 400.",
                vista: "aspect-[36/5]",
              },
              {
                campo: "banner_movil",
                titulo: "Celular",
                medida: "Más alto, por ejemplo 1236 × 600.",
                vista: "aspect-[2/1] max-w-xs",
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
                      Marco por defecto
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
          Escribir los nombres y la fecha sobre el banner
        </label>
      </section>

      <section>
        <h2 className="mb-1 font-medium">Plano del lugar</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Si no hay plano, la sección Mapa no se le muestra a los invitados.
        </p>
        {form.mapa && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={urlArchivo(form.mapa)}
            alt="Plano del lugar"
            className="mb-3 w-56 rounded-lg border border-neutral-200"
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
            {subiendo === "mapa" ? "Subiendo…" : "Subir plano"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subir(f, "mapa");
                e.target.value = "";
              }}
            />
          </label>
          {form.mapa && (
            <button
              onClick={() => guardar({ mapa: "" }, "Plano quitado")}
              className="text-sm text-neutral-500 underline hover:text-neutral-800"
            >
              Quitar plano
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-medium">QR del matrimonio</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Un solo QR para todos los invitados: lleva a {urlPublica}
        </p>
        <div className="flex flex-wrap items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/eventos/${evento.slug}/qr`}
            alt={`QR de ${evento.nombre1} y ${evento.nombre2}`}
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
        <h2 className="mb-1 font-medium">Pantalla del salón</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Para proyectar en el telón o la pantalla LED: va rotando las fotos y los mensajes
          que llegan, y muestra el QR al lado para que se sumen más invitados. El enlace trae
          su propia clave, así que en el computador del salón no hay que escribir la
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
            Fondo oscuro (para salones a oscuras)
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
        <h2 className="mb-1 font-medium">Clave de los novios</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Con esta clave los novios entran a este panel y solo a este: cargan su
          agenda, crean sus votaciones y ven sus fotos, sin ver los demás matrimonios.
          No pueden cambiar la dirección web ni eliminar el matrimonio.
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
            onClick={() => cambiarClaveNovios(claveNueva)}
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
              onClick={() => cambiarClaveNovios("")}
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
          <h2 className="mb-1 font-medium text-rose-900">Eliminar matrimonio</h2>
          <p className="mb-3 text-sm text-rose-800">
            Borra el matrimonio junto con sus invitados, mensajes y fotos.
          </p>
          <button
            onClick={eliminar}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700"
          >
            Eliminar
          </button>
        </section>
      )}

      {estado && <p className="text-sm text-neutral-500">{estado}</p>}
    </div>
  );
}
