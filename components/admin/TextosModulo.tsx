"use client";

import { useState } from "react";
import { BotonRosa, TarjetaAccion, Tarjeta, Titulo } from "@/components/ui";
import { IconoModulo } from "@/components/Icons";
import type { EventoPanel } from "@/lib/eventos";
import { paletaEvento, variablesPaleta } from "@/lib/config";
import { definicion, type ModuloId } from "@/lib/modulos";
import {
  INICIO_PREDETERMINADO,
  LARGOS,
  SIN_TITULO,
  leerTextos,
  predeterminados,
  textosInicio,
  textosModulo,
  type Textos,
  type TextosInicio,
  type TextosModulo as Valores,
} from "@/lib/textos";

const CAMPO = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

async function guardarTextos(evento: EventoPanel, textos: Textos): Promise<EventoPanel> {
  const res = await fetch(`/api/eventos/${evento.slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ textos }),
  });
  if (!res.ok) throw new Error("No pudimos guardar los textos.");
  return res.json();
}

/** Lo que se ve en la vista previa: el sitio del evento, con su paleta y su letra. */
function MarcoVistaPrevia({ evento, children }: { evento: EventoPanel; children: React.ReactNode }) {
  return (
    <div
      style={variablesPaleta(paletaEvento(evento)) as React.CSSProperties}
      className={`rounded-xl bg-background px-4 py-5 text-foreground ${
        evento.tipo === "activacion" ? "pantalla-activacion font-sans" : ""
      }`}
    >
      {children}
    </div>
  );
}

// Los textos de un módulo: título de su página, texto de su tarjeta en el
// inicio y el botón. Se editan con la vista previa al lado y se publican al
// guardar; lo que quede igual al predeterminado sigue al predeterminado.
export default function TextosModulo({
  evento,
  id,
  onGuardado,
}: {
  evento: EventoPanel;
  id: ModuloId;
  onGuardado: (e: EventoPanel) => void;
}) {
  const base = predeterminados(evento.tipo, id);
  const [valores, setValores] = useState<Valores>(() => textosModulo(evento, id));
  const [estado, setEstado] = useState("");
  const [guardando, setGuardando] = useState(false);

  const modulo = definicion(id);
  const destacado = Boolean(modulo.destacado);
  const conTitulo = !SIN_TITULO.includes(id);
  const propios = leerTextos(evento.textos).modulos[id] ?? {};
  const personalizado = Object.keys(propios).length > 0;
  const cambiado = (["titulo", "tarjeta", "boton"] as const).some(
    (c) => valores[c].trim() !== textosModulo(evento, id)[c]
  );

  async function publicar(nuevos: Valores | null, mensaje: string) {
    setGuardando(true);
    setEstado("Guardando…");
    try {
      const textos = leerTextos(evento.textos);
      if (nuevos) textos.modulos[id] = nuevos;
      else delete textos.modulos[id];
      onGuardado(await guardarTextos(evento, textos));
      if (!nuevos) setValores(base);
      setEstado(mensaje);
    } catch (e) {
      setEstado(e instanceof Error ? e.message : "No pudimos guardar los textos.");
    } finally {
      setGuardando(false);
    }
  }

  const cambiar = (campo: keyof Valores) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValores({ ...valores, [campo]: e.target.value });
  // Lo vacío se muestra como el predeterminado, igual que en el sitio.
  const visible = (campo: keyof Valores) => valores[campo].trim() || base[campo];

  return (
    <div className="grid gap-5 border-t border-neutral-200 bg-neutral-50 p-4 md:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        {conTitulo && (
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-500">
              {destacado ? "Título del buscador" : "Título de su página"}
            </span>
            <input
              value={valores.titulo}
              onChange={cambiar("titulo")}
              placeholder={base.titulo}
              maxLength={LARGOS.titulo}
              className={CAMPO}
            />
          </label>
        )}
        {!destacado && (
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-500">
              Texto de la tarjeta en el inicio (admite un salto de línea)
            </span>
            <textarea
              value={valores.tarjeta}
              onChange={cambiar("tarjeta")}
              placeholder={base.tarjeta}
              maxLength={LARGOS.tarjeta}
              rows={2}
              className={`${CAMPO} resize-none`}
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">Texto del botón</span>
          <input
            value={valores.boton}
            onChange={cambiar("boton")}
            placeholder={base.boton}
            maxLength={LARGOS.boton}
            className={CAMPO}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() =>
              publicar(
                {
                  titulo: valores.titulo.trim(),
                  tarjeta: valores.tarjeta.trim(),
                  boton: valores.boton.trim(),
                },
                "Textos publicados"
              )
            }
            disabled={guardando || !cambiado}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40"
          >
            Guardar y publicar
          </button>
          {(personalizado || cambiado) && (
            <button
              onClick={() => (personalizado ? publicar(null, "Textos predeterminados") : setValores(base))}
              disabled={guardando}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-white"
            >
              {personalizado ? "Volver a los predeterminados" : "Descartar cambios"}
            </button>
          )}
          {estado && <span className="text-sm text-neutral-500">{estado}</span>}
        </div>
        {modulo.id === "registro" && (
          <p className="text-xs text-neutral-400">El título del formulario se edita en la pestaña Registro.</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          Vista previa{cambiado ? " · sin publicar" : ""}
        </p>
        <MarcoVistaPrevia evento={evento}>
          {destacado ? (
            <Tarjeta className="py-[18px]!">
              <div className="mb-3 flex items-center gap-3 pl-2.5">
                <IconoModulo id={id} className="h-[34px] w-auto shrink-0" />
                <p className="font-serif text-base font-bold">{visible("titulo")}</p>
              </div>
              <div className="mb-1.5 w-full rounded-[9px] bg-white px-3 py-2 text-[13px] text-neutral-400">
                Ingresa tu nombre y apellido
              </div>
              <BotonRosa>{visible("boton")}</BotonRosa>
            </Tarjeta>
          ) : (
            <>
              <TarjetaAccion
                icon={<IconoModulo id={id} className="h-[34px] w-auto" />}
                texto={visible("tarjeta")}
                boton={visible("boton")}
              />
              {conTitulo && (
                <div className="mt-5 border-t border-dashed border-current/15 pt-4">
                  <p className="mb-2 text-center text-[10px] uppercase tracking-wide opacity-50">
                    Título de la página
                  </p>
                  <Titulo>{visible("titulo")}</Titulo>
                </div>
              )}
            </>
          )}
        </MarcoVistaPrevia>
      </div>
    </div>
  );
}

// El saludo y el subtítulo del inicio del sitio.
export function TextosDelInicio({
  evento,
  onGuardado,
}: {
  evento: EventoPanel;
  onGuardado: (e: EventoPanel) => void;
}) {
  const [valores, setValores] = useState<TextosInicio>(() => textosInicio(evento));
  const [estado, setEstado] = useState("");
  const actuales = textosInicio(evento);
  const cambiado = valores.saludo.trim() !== actuales.saludo || valores.durante.trim() !== actuales.durante;

  async function publicar(nuevos: TextosInicio, mensaje: string) {
    setEstado("Guardando…");
    try {
      const textos = { ...leerTextos(evento.textos), saludo: nuevos.saludo.trim(), durante: nuevos.durante.trim() };
      onGuardado(await guardarTextos(evento, textos));
      setValores({
        saludo: nuevos.saludo.trim() || INICIO_PREDETERMINADO.saludo,
        durante: nuevos.durante.trim() || INICIO_PREDETERMINADO.durante,
      });
      setEstado(mensaje);
    } catch (e) {
      setEstado(e instanceof Error ? e.message : "No pudimos guardar los textos.");
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 p-4">
      <h3 className="mb-1 font-medium">Textos del inicio</h3>
      <p className="mb-3 text-sm text-neutral-500">
        El saludo de arriba y lo que va antes de las tarjetas de los módulos.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Saludo</span>
          <input
            value={valores.saludo}
            onChange={(e) => setValores({ ...valores, saludo: e.target.value })}
            placeholder={INICIO_PREDETERMINADO.saludo}
            maxLength={LARGOS.saludo}
            className={CAMPO}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Antes de las tarjetas</span>
          <input
            value={valores.durante}
            onChange={(e) => setValores({ ...valores, durante: e.target.value })}
            placeholder={INICIO_PREDETERMINADO.durante}
            maxLength={LARGOS.durante}
            className={CAMPO}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => publicar(valores, "Textos del inicio publicados")}
          disabled={!cambiado}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          Guardar y publicar
        </button>
        {(actuales.saludo !== INICIO_PREDETERMINADO.saludo || actuales.durante !== INICIO_PREDETERMINADO.durante) && (
          <button
            onClick={() => publicar({ saludo: "", durante: "" }, "Textos predeterminados")}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Volver a los predeterminados
          </button>
        )}
        {estado && <span className="text-sm text-neutral-500">{estado}</span>}
      </div>
    </section>
  );
}
