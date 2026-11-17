"use client";

import { useState } from "react";
import { BotonRosa, TarjetaAccion, Tarjeta, Titulo } from "@/components/ui";
import { IconoModulo } from "@/components/Icons";
import type { EventoPanel } from "@/lib/eventos";
import { paletaEvento, variablesPaleta } from "@/lib/config";
import { definicion, type ModuloId } from "@/lib/modulos";
import {
  asignacionDe,
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
  const guardados = leerTextos(evento.textos);
  const base = predeterminados(evento.tipo, id, guardados.asignacion);
  const [valores, setValores] = useState<Valores>(() => textosModulo(evento, id));
  const [estado, setEstado] = useState("");
  const [guardando, setGuardando] = useState(false);

  const modulo = definicion(id);
  const destacado = Boolean(modulo.destacado);
  const conTitulo = !SIN_TITULO.includes(id);
  const propios = guardados.modulos[id] ?? {};
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
        {id === "mesa" && (
          <PalabraAsignacion
            evento={evento}
            onGuardado={(e) => {
              onGuardado(e);
              // Los textos que siguen al predeterminado cambian con la palabra.
              setValores(textosModulo(e, id));
            }}
          />
        )}
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

// Lo que entrega el buscador: "mesa", "sector" o la palabra que se contrate
// (sala, stand…). Solo la cambia la clave maestra; con la clave del evento se ve.
function PalabraAsignacion({ evento, onGuardado }: { evento: EventoPanel; onGuardado: (e: EventoPanel) => void }) {
  const propia = leerTextos(evento.textos).asignacion;
  const actual = asignacionDe(evento.tipo, propia);
  const [nombre, setNombre] = useState(actual.nombre);
  const [femenino, setFemenino] = useState(actual.femenino);
  const [estado, setEstado] = useState("");

  if (!evento.maestra) {
    return (
      <p className="text-sm text-neutral-500">
        Cada participante ve su <strong className="font-medium text-neutral-700">{actual.nombre}</strong>. Para usar otra palabra (sala, stand…) pídelo a Venito.
      </p>
    );
  }

  const limpio = nombre.trim();
  const cambiado = limpio !== actual.nombre || femenino !== actual.femenino;
  async function guardar(asignacion: { nombre: string; femenino: boolean }, mensaje: string) {
    setEstado("Guardando…");
    try {
      const actualizado = await guardarTextos(evento, { ...leerTextos(evento.textos), asignacion });
      const nueva = asignacionDe(actualizado.tipo, leerTextos(actualizado.textos).asignacion);
      setNombre(nueva.nombre);
      setFemenino(nueva.femenino);
      onGuardado(actualizado);
      setEstado(mensaje);
    } catch (e) {
      setEstado(e instanceof Error ? e.message : "No pudimos guardar los textos.");
    }
  }

  return (
    <fieldset className="rounded-lg border border-neutral-200 bg-white p-3">
      <legend className="px-1 text-sm font-medium">Lo que se asigna</legend>
      <p className="mb-2 text-xs text-neutral-500">Solo con la clave maestra: otra palabra que mesa o sector se cobra aparte.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Palabra</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={asignacionDe(evento.tipo).nombre}
            maxLength={LARGOS.asignacion}
            className={`${CAMPO} w-44`}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Se dice</span>
          <select value={femenino ? "a" : "o"} onChange={(e) => setFemenino(e.target.value === "a")} className={`${CAMPO} w-auto`}>
            <option value="a">asignada</option>
            <option value="o">asignado</option>
          </select>
        </label>
        <button
          onClick={() => guardar({ nombre: limpio, femenino }, "Palabra publicada")}
          disabled={!cambiado || !limpio}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          Guardar
        </button>
        {propia.nombre && (
          <button
            onClick={() => guardar({ nombre: "", femenino: true }, "Palabra predeterminada")}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Volver a «{asignacionDe(evento.tipo).nombre}»
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        El participante verá: «Tu {limpio || actual.nombre} {femenino ? "asignada" : "asignado"} es: 12»
        {estado && <span className="ml-2 text-neutral-500">· {estado}</span>}
      </p>
    </fieldset>
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
