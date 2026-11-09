"use client";

/* eslint-disable @next/next/no-img-element -- logos e íconos SVG del diseño a su tamaño exacto */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Login from "@/components/admin/Login";
import FormCliente from "@/components/admin/FormCliente";
import { LogoCliente, MarcoVenito } from "@/components/admin/Marca";
import { modulosActivos } from "@/lib/modulos";
import { etiquetaEvento } from "@/lib/identidad";
import type { Cliente, Evento } from "@/lib/db";

type Resumen = { participantes?: number; invitados: number; mesas: number; mensajes: number; fotos: number };
type EventoConResumen = Evento & { resumen: Resumen };

const NUEVO = { tipo: "activacion", titulo: "", descripcion: "", nombre1: "", nombre2: "", fecha: "" };

// Eventos de un cliente (Figma "quick-wins", Desktop 2): cada uno con su
// dirección, su fecha y lo que lleva juntado.
export default function AdminCliente() {
  const { cliente: slugCliente } = useParams<{ cliente: string }>();
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [eventos, setEventos] = useState<EventoConResumen[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [existe, setExiste] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/clientes/${slugCliente}`),
      fetch(`/api/eventos?cliente=${encodeURIComponent(slugCliente)}`),
    ])
      .then(async ([rc, re]) => {
        if (rc.status === 401) {
          setAuthed(false);
          return;
        }
        if (rc.status === 404) {
          setExiste(false);
          setAuthed(true);
          return;
        }
        if (!rc.ok || !re.ok) throw new Error();
        setCliente(await rc.json());
        setEventos(await re.json());
        setErrorCarga("");
        setAuthed(true);
      })
      .catch(() => setErrorCarga("No pudimos cargar los eventos. Revisa tu conexión e intenta otra vez."));
  }, [slugCliente]);

  useEffect(() => {
    load();
  }, [load]);

  async function salir() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...nuevo, cliente: slugCliente }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No pudimos crear el evento.");
      return;
    }
    router.push(`/admin/${data.slug}`);
  }

  if (authed === false) return <Login onOk={load} />;

  if (errorCarga || !existe) {
    return (
      <MarcoVenito>
        <main className="mx-auto w-full max-w-[1440px] px-6 pt-16 md:px-[83px]">
          <p role="alert" className="text-[22px]">
            {errorCarga || "Ese cliente no existe."}
          </p>
          <div className="mt-6 flex gap-3">
            {errorCarga && (
              <button onClick={load} className="rounded-full border-2 border-neutral-200 px-5 py-2">
                Reintentar
              </button>
            )}
            <Link href="/admin" className="rounded-full bg-venito px-5 py-2 font-bold">
              Ver todos los clientes
            </Link>
          </div>
        </main>
      </MarcoVenito>
    );
  }

  // Un cliente que solo hace activaciones las ve nombradas así, como en el diseño.
  const soloActivaciones = cliente && cliente.id !== 0 && eventos.every((e) => e.tipo === "activacion");
  const bajada = soloActivaciones
    ? "Activaciones, cada una con su dirección, QR y participantes."
    : "Matrimonios y activaciones, cada uno con su dirección, QR y participantes.";

  return (
    <MarcoVenito>
      <main className="mx-auto w-full max-w-[1440px] px-5 md:px-[74px]">
        <div className="flex items-start justify-between gap-6 pt-8 md:pt-[51px]">
          <div className="min-w-0 md:pl-[9px] md:pt-[11px]">
            <Link href="/admin" aria-label="Venito: todos los clientes" className="block w-fit">
              <img src="/brand/venito-negro.svg" alt="Venito" className="block h-[31.406px] w-[105px]" />
            </Link>
            {cliente && (
              <p className="mt-5 text-[18px] leading-[1.32] md:ml-[6px] md:text-[22px]">
                {cliente.nombre} / {bajada}
              </p>
            )}
            {cliente && cliente.id !== 0 && !editando && (
              <button
                onClick={() => setEditando(true)}
                className="mt-1 text-sm text-venito-gris underline hover:text-black md:ml-[6px]"
              >
                Editar cliente
              </button>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-[7px]">
            {cliente && (
              <LogoCliente
                cliente={cliente}
                className={`h-[46px] w-[86px] md:h-[62px] md:w-[115px] ${cliente.id === 0 ? "rounded-[14px] bg-venito" : ""}`}
              />
            )}
            <button onClick={salir} className="text-[16px] font-bold hover:underline md:text-[22px]">
              Cerrar sesión
            </button>
          </div>
        </div>

        {cliente && editando && (
          <FormCliente
            cliente={cliente}
            onCancelar={() => setEditando(false)}
            onListo={(c) => {
              setCliente(c);
              setEditando(false);
            }}
            onEliminado={() => router.push("/admin")}
          />
        )}

        {authed === null ? (
          <p className="mt-10 text-venito-gris">Cargando…</p>
        ) : (
          <>
            <button
              onClick={() => setCreando((v) => !v)}
              aria-expanded={creando}
              className="mt-[31px] flex size-[110px] flex-col items-center gap-1 rounded-[26.125px] border-[2.063px] border-dashed border-venito-gris pt-[26px] text-venito-gris transition hover:border-black hover:text-black md:ml-[9px]"
            >
              <img src="/brand/mas.svg" alt="" className="size-[26.927px]" />
              <span className="w-[96.25px] text-center text-[15.125px] leading-[15.125px]">
                Crear nuevo evento
              </span>
            </button>

            {creando && (
              <form
                onSubmit={crear}
                className="mt-6 w-full max-w-[673px] rounded-[38px] border-[3px] border-venito p-6 md:p-8"
              >
                <p className="mb-4 text-[22px] font-bold">Nuevo evento</p>
                <label className="mb-4 block">
                  <span className="mb-1 block text-sm font-bold">Tipo de experiencia</span>
                  <select
                    value={nuevo.tipo}
                    onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}
                    className="w-full rounded-2xl border-2 border-neutral-200 bg-white px-4 py-2.5"
                  >
                    <option value="matrimonio">Matrimonio</option>
                    <option value="activacion">Activación de marca o evento</option>
                  </select>
                </label>
                {nuevo.tipo === "activacion" ? (
                  <div className="mb-4 space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-sm font-bold">Nombre del evento</span>
                      <input
                        required
                        value={nuevo.titulo}
                        onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })}
                        className="w-full rounded-2xl border-2 border-neutral-200 px-4 py-2.5 outline-none focus:border-venito"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-bold">Mensaje de bienvenida</span>
                      <textarea
                        value={nuevo.descripcion}
                        onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
                        className="w-full rounded-2xl border-2 border-neutral-200 px-4 py-2.5 outline-none focus:border-venito"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <input
                      required
                      value={nuevo.nombre1}
                      onChange={(e) => setNuevo({ ...nuevo, nombre1: e.target.value })}
                      placeholder="Nombre de la novia"
                      aria-label="Nombre de la novia"
                      className="rounded-2xl border-2 border-neutral-200 px-4 py-2.5 outline-none focus:border-venito"
                    />
                    <input
                      required
                      value={nuevo.nombre2}
                      onChange={(e) => setNuevo({ ...nuevo, nombre2: e.target.value })}
                      placeholder="Nombre del novio"
                      aria-label="Nombre del novio"
                      className="rounded-2xl border-2 border-neutral-200 px-4 py-2.5 outline-none focus:border-venito"
                    />
                  </div>
                )}
                <input
                  value={nuevo.fecha}
                  onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })}
                  placeholder="Fecha del evento (15 · 03 · 2027)"
                  aria-label="Fecha del evento"
                  className="mb-4 w-full rounded-2xl border-2 border-neutral-200 px-4 py-2.5 outline-none focus:border-venito"
                />
                {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
                <div className="flex gap-3">
                  <button type="submit" className="rounded-full bg-venito px-6 py-2.5 font-bold hover:brightness-95">
                    Crear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreando(false);
                      setNuevo(NUEVO);
                    }}
                    className="rounded-full border-2 border-neutral-200 px-6 py-2 hover:border-neutral-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <ul className="mt-[31px] flex max-w-[673px] flex-col gap-[19px]" aria-label="Eventos">
              {eventos.map((e) => (
                <li key={e.id}>
                  <TarjetaEvento evento={e} />
                </li>
              ))}
              {eventos.length === 0 && (
                <li className="rounded-[38px] border-[3px] border-dashed border-venito-gris px-[41px] py-8 text-[18px] text-venito-gris md:text-[22px]">
                  Aún no hay eventos{cliente ? ` de ${cliente.nombre}` : ""}. Crea el primero arriba.
                </li>
              )}
            </ul>
          </>
        )}
      </main>
    </MarcoVenito>
  );
}

function TarjetaEvento({ evento: e }: { evento: EventoConResumen }) {
  const activacion = e.tipo === "activacion";
  const datos = [
    `${e.resumen.participantes ?? 0} registros`,
    ...(activacion ? [] : [`${e.resumen.invitados} participantes`]),
    `${e.resumen.mensajes} mensajes`,
    `${e.resumen.fotos} fotos`,
    `${modulosActivos(e).length} módulos`,
  ];
  return (
    <Link
      href={`/admin/${e.slug}`}
      className="block rounded-[38px] border-[3px] border-venito px-5 py-[22px] transition hover:bg-venito/5 focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-black md:px-[41px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[18px] font-bold leading-[1.32] md:text-[22px]">
            {activacion ? "" : "Matrimonio de "}
            {etiquetaEvento(e)}
          </p>
          <p className="mt-1 break-all text-[18px] leading-[1.32] md:text-[22px]">Link: /{e.slug}</p>
        </div>
        <span
          className={`-mr-2 -mt-2 shrink-0 whitespace-nowrap rounded-full bg-venito/40 px-4 py-[9px] text-center leading-[1.32] md:-mr-[25px] md:-mt-[10px] md:w-[154px] md:px-0.5 ${
            e.fecha ? "text-[16px] md:text-[20px]" : "text-[16px] md:text-[22px]"
          }`}
        >
          {e.fecha || "Sin fecha"}
        </span>
      </div>
      <p className="mt-[19px] flex flex-wrap gap-x-[0.3em] text-[16px] leading-[1.32] md:text-[22px]">
        {datos.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </p>
    </Link>
  );
}
