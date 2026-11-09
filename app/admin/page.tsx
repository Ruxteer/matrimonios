"use client";

/* eslint-disable @next/next/no-img-element -- ícono SVG del diseño a su tamaño exacto */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Login from "@/components/admin/Login";
import FormCliente from "@/components/admin/FormCliente";
import { Bienvenida, MarcoVenito, TarjetaCliente } from "@/components/admin/Marca";
import type { Cliente } from "@/lib/db";

type ClienteConEventos = Cliente & { eventos: number };

// Portada del panel (Figma "quick-wins", Desktop 1): Venito y cada cliente
// como una tarjeta; dentro de cada una están sus eventos.
export default function AdminInicio() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteConEventos[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");

  const load = useCallback(() => {
    fetch("/api/clientes")
      .then(async (r) => {
        if (r.status === 401) {
          setAuthed(false);
          return;
        }
        if (!r.ok) throw new Error();
        setClientes(await r.json());
        setErrorCarga("");
        setAuthed(true);
      })
      .catch(() => setErrorCarga("No pudimos cargar los clientes. Revisa tu conexión e intenta otra vez."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function salir() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  if (authed === false) return <Login onOk={load} />;

  return (
    <MarcoVenito>
      <main className="relative mx-auto w-full max-w-[986px] px-6 pt-16 md:pt-[180px]">
        {authed && (
          <button
            onClick={salir}
            className="absolute right-6 top-5 text-sm font-bold text-venito-gris hover:text-black md:top-[62px]"
          >
            Cerrar sesión
          </button>
        )}
        <Bienvenida />

        {errorCarga ? (
          <div className="mt-12" role="alert">
            <p>{errorCarga}</p>
            <button onClick={load} className="mt-4 rounded-full border-2 border-neutral-200 px-5 py-2">
              Reintentar
            </button>
          </div>
        ) : authed === null ? (
          <p className="mt-12 text-venito-gris md:mt-[88px]">Cargando…</p>
        ) : (
          <>
            <ul className="mt-12 flex flex-wrap gap-4 md:mt-[88px]" aria-label="Clientes">
              {clientes.map((c) => (
                <li key={c.id}>
                  <TarjetaCliente cliente={c} />
                </li>
              ))}
              <li>
                <button
                  onClick={() => setAgregando(true)}
                  aria-expanded={agregando}
                  className="flex size-[160px] flex-col items-center gap-[3px] rounded-[38px] border-[3px] border-dashed border-venito-gris pt-[35px] text-venito-gris transition hover:border-black hover:text-black"
                >
                  <img src="/brand/mas-grande.svg" alt="" className="size-[39.1667px]" />
                  <span className="w-[120px] text-center text-[22px] leading-[28px]">
                    Agregar cliente
                  </span>
                </button>
              </li>
            </ul>

            {agregando && (
              <FormCliente
                onCancelar={() => setAgregando(false)}
                onListo={(c) => router.push(`/admin/clientes/${c.slug}`)}
              />
            )}
          </>
        )}
      </main>
    </MarcoVenito>
  );
}
