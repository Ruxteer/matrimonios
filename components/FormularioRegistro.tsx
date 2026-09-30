"use client";

import { useEffect, useState, type ComponentProps, type FormEvent } from "react";
import Link from "next/link";
import { BotonRosa } from "./ui";
import { registroDisponible, type RegistroConfig } from "@/lib/registro";

type Participante = {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  consentimiento_informacion: boolean;
  consentimiento_marketing: boolean;
  campos_extra: Record<string, string>;
  created_at: string;
};

const INPUT = "mt-1.5 min-h-11 w-full rounded-[9px] border border-transparent bg-white px-3 py-2.5 text-base outline-none placeholder:text-neutral-400 focus:border-rosa focus:ring-2 focus:ring-rosa/30";
const CARD = "mx-auto w-full max-w-[420px] rounded-[20px] bg-gris-card p-5 shadow-sm sm:p-6";

function Accion({ activacion, children, href, className = "", ...props }: ComponentProps<typeof BotonRosa> & { activacion: boolean }) {
  if (!activacion) return <BotonRosa href={href} className={className} {...props}>{children}</BotonRosa>;
  const clases = `flex min-h-12 w-full items-center justify-center gap-4 rounded-full bg-rosa px-5 py-3 text-center text-sm font-semibold text-rosa-texto transition hover:brightness-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rosa ${className}`;
  const contenido = <>{children}<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></>;
  if (href) return <Link href={href} className={clases}>{contenido}</Link>;
  return <button {...props} type={props.type ?? "button"} className={clases}>{contenido}</button>;
}

function IconoCampo({ tipo }: { tipo: "nombre" | "email" | "telefono" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-65">
      {tipo === "nombre" && <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2z" /></>}
      {tipo === "email" && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>}
      {tipo === "telefono" && <path d="m7 3 4 5-3 3a15 15 0 0 0 5 5l3-3 5 4-2 4C9 22 2 15 3 5z" />}
    </svg>
  );
}

export default function FormularioRegistro({
  slug,
  config,
  fotosActivo = false,
  volverInicio = true,
  activacion = false,
}: {
  slug: string;
  config: RegistroConfig;
  fotosActivo?: boolean;
  volverInicio?: boolean;
  activacion?: boolean;
}) {
  const card = activacion ? "event-card activation-form mx-auto w-full max-w-[420px] rounded-[24px] bg-gris-card p-6 font-sans text-foreground" : CARD;
  const input = activacion ? "min-h-[50px] w-full rounded-[14px] border border-rosa/15 bg-white py-3 pl-12 pr-4 text-base font-normal text-foreground placeholder:text-[13px] outline-none placeholder:text-foreground/55 focus:border-rosa focus:ring-2 focus:ring-rosa/15" : INPUT;
  const tituloClase = activacion ? "activation-heading text-center text-[36px] font-black leading-[1.05] tracking-[-0.045em]" : "text-center font-serif text-2xl font-bold";
  const checkClase = activacion ? "mt-0.5 h-[19px] w-[19px] shrink-0 rounded accent-rosa" : "mt-0.5 h-5 w-5 shrink-0 accent-rosa";
  const consentimientoClase = activacion ? "flex cursor-pointer items-start gap-3 py-1.5 text-xs leading-[1.5]" : "flex cursor-pointer items-start gap-3 py-2 text-sm leading-relaxed";
  const [participante, setParticipante] = useState<Participante | null>(null);
  const [fotos, setFotos] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [consultaError, setConsultaError] = useState("");
  const [intento, setIntento] = useState(0);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [legal, setLegal] = useState(false);
  const [informacion, setInformacion] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [bloqueadoServidor, setBloqueadoServidor] = useState("");
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/eventos/${encodeURIComponent(slug)}/registro`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No pudimos comprobar tu registro.");
        setParticipante(data.participante ?? null);
        setFotos(data.fotos ?? 0);
        setConsultaError("");
        setAhora(Date.now());
        setCargando(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setConsultaError(err instanceof Error ? err.message : "No pudimos comprobar tu registro.");
        setCargando(false);
      });
    const timer = window.setInterval(() => setAhora(Date.now()), 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [slug, intento]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    setError("");
    setEnviando(true);
    try {
      const res = await fetch(`/api/eventos/${encodeURIComponent(slug)}/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
          consentimiento_legal: legal,
          consentimiento_informacion: informacion,
          consentimiento_marketing: marketing,
          campos_extra: extras,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const mensaje = data.error || "No pudimos guardar tu registro. Intenta nuevamente.";
        if (res.status === 403 || res.status === 404) {
          setBloqueadoServidor(mensaje);
        } else {
          setError(mensaje);
        }
        return;
      }
      if (!data.participante) throw new Error("No pudimos confirmar el registro. Vuelve a intentarlo.");
      setParticipante(data.participante);
      setFotos(data.fotos ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos conectar. Revisa tu conexión e intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return <div className={card} role="status"><p className="py-8 text-center text-sm">Comprobando tu registro…</p></div>;
  }

  if (consultaError) {
    return (
      <div className={`${card} text-center`}>
        <p role="alert" className="mb-4 text-sm">{consultaError}</p>
        <Accion activacion={activacion} onClick={() => { setCargando(true); setIntento((n) => n + 1); }} className="min-h-11">Intentar nuevamente</Accion>
      </div>
    );
  }

  if (participante) {
    const restantes = Math.max(0, config.fotos_por_participante - fotos);
    return (
      <section className={`${card} text-center`} aria-live="polite">
        <span aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rosa text-2xl text-rosa-texto">✓</span>
        <h2 className={`mb-2 ${tituloClase}`}>{activacion ? "¡Ya participas!" : "¡Ya estás registrado!"}</h2>
        {activacion && <p className="activation-subtitle mb-4 text-[13px] font-bold tracking-[0.2em] text-rosa">REGISTRO CONFIRMADO</p>}
        <p className="mb-4 whitespace-pre-line text-sm leading-relaxed">{config.confirmacion}</p>
        <p className="mb-5 break-words rounded-xl bg-white/60 p-3 text-sm">Registro de <strong>{participante.nombre}</strong></p>
        {config.siguiente_paso && <p className="mb-3 whitespace-pre-line text-sm font-medium">{config.siguiente_paso}</p>}
        {fotosActivo && restantes > 0 && (
          <>
            <Accion activacion={activacion} href={`/${slug}/foto`} className="min-h-11 py-3 text-sm">{activacion ? "Compartir mi foto" : "Compartir mi foto →"}</Accion>
            <p className="mt-2 text-xs opacity-70">Puedes compartir {restantes} {restantes === 1 ? "foto más" : "fotos más"}.</p>
          </>
        )}
        {fotosActivo && restantes === 0 && <p className="mb-4 text-sm">Ya compartiste el máximo de fotos permitido para este evento.</p>}
        {volverInicio && <Link href={`/${slug}`} className="mt-5 inline-block py-2 text-sm underline underline-offset-4">Volver al evento</Link>}
      </section>
    );
  }

  const legalListo = Boolean(config.terminos_url && config.privacidad_url && config.consentimiento_texto.trim());
  let bloqueo = bloqueadoServidor;
  if (!bloqueo && !legalListo) bloqueo = "La organización está preparando el registro. Vuelve a consultar más adelante.";
  if (!bloqueo && !registroDisponible(config, ahora)) {
    bloqueo = config.abierto && config.inicio && Date.parse(config.inicio) > ahora
      ? "El registro todavía no ha comenzado. Vuelve a consultar cuando abra la participación."
      : "El registro de este evento está cerrado.";
  }

  if (bloqueo) {
    return (
      <section className={`${card} text-center`}>
        <h2 className={activacion ? "mb-3 text-2xl font-black tracking-tight" : "mb-3 font-serif text-xl font-bold"}>Registro no disponible</h2>
        <p role="status" className="text-sm leading-relaxed">{bloqueo}</p>
        {volverInicio && <Link href={`/${slug}`} className="mt-5 inline-block py-2 text-sm underline underline-offset-4">Volver al evento</Link>}
      </section>
    );
  }

  return (
    <form onSubmit={enviar} className={card} aria-busy={enviando}>
      <h2 className={`mb-1 ${tituloClase}`}>{activacion && (!config.titulo || config.titulo === "Regístrate para participar") ? "Regístrate" : config.titulo || "Regístrate para participar"}</h2>
      {activacion && <p className="activation-subtitle mb-3 text-center text-[16px] font-bold tracking-[0.25em] text-rosa">Y PARTICIPA</p>}
      {config.descripcion && <p className={activacion ? "mx-auto mb-5 max-w-[285px] whitespace-pre-line text-center text-[13px] leading-[1.45] text-foreground/65" : "mb-5 whitespace-pre-line text-center text-sm leading-relaxed"}>{config.descripcion}</p>}
      {!activacion && <p className="mb-5 text-center text-xs opacity-70">No necesitas crear una cuenta. Los campos con * son obligatorios.</p>}
      <fieldset disabled={enviando} className={`${activacion ? "space-y-2.5" : "space-y-4"} disabled:opacity-70`}>
        <legend className="sr-only">Tus datos</legend>
        <label className="block text-sm font-medium" htmlFor="registro-nombre"><span className={activacion ? "sr-only" : undefined}>Nombre completo *</span>
          <span className="relative block">{activacion && <IconoCampo tipo="nombre" />}<input id="registro-nombre" name="nombre" autoComplete="name" placeholder={activacion ? "Nombre completo" : undefined} required minLength={2} maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} className={input} /></span>
        </label>
        <label className="block text-sm font-medium" htmlFor="registro-email"><span className={activacion ? "sr-only" : undefined}>Correo electrónico *</span>
          <span className="relative block">{activacion && <IconoCampo tipo="email" />}<input id="registro-email" name="email" type="email" autoComplete="email" placeholder={activacion ? "Correo electrónico" : undefined} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></span>
        </label>
        <label className="block text-sm font-medium" htmlFor="registro-telefono"><span className={activacion ? "sr-only" : undefined}>Teléfono {config.telefono_obligatorio ? "*" : "(opcional)"}</span>
          <span className="relative block">{activacion && <IconoCampo tipo="telefono" />}<input id="registro-telefono" name="telefono" type="tel" autoComplete="tel" placeholder={activacion ? config.telefono_obligatorio ? "+56 · Número de teléfono" : "+56 · Teléfono (opcional)" : "+56 9 1234 5678"} required={config.telefono_obligatorio} maxLength={32} value={telefono} onChange={(e) => setTelefono(e.target.value)} className={input} /></span>
        </label>
        {config.campos_extra.map((campo) => (
          <label key={campo.id} className="block text-sm font-medium" htmlFor={`registro-extra-${campo.id}`}>{campo.label} {campo.obligatorio ? "*" : "(opcional)"}
            <input id={`registro-extra-${campo.id}`} name={`extra-${campo.id}`} required={campo.obligatorio} maxLength={500} value={extras[campo.id] ?? ""} onChange={(e) => setExtras((actual) => ({ ...actual, [campo.id]: e.target.value }))} className={activacion ? "mt-1.5 min-h-[50px] w-full rounded-[14px] border border-rosa/15 bg-white px-4 py-3 text-base outline-none focus:border-rosa focus:ring-2 focus:ring-rosa/15" : INPUT} />
          </label>
        ))}
        <div className={activacion ? "space-y-1 pt-2 text-foreground/80" : "space-y-2 border-t border-foreground/10 pt-4"}>
          <label className={consentimientoClase}>
            <input type="checkbox" name="consentimiento_legal" required checked={legal} onChange={(e) => setLegal(e.target.checked)} className={checkClase} />
            <span>{config.consentimiento_texto} <span aria-hidden="true">*</span></span>
          </label>
          <div className={activacion ? "mb-2 pl-8 text-xs leading-relaxed text-rosa" : "mb-3 pl-8 text-xs leading-relaxed"}>
            <a href={config.terminos_url} target="_blank" rel="noopener noreferrer" className="inline-block py-1 underline underline-offset-2">Términos y condiciones ↗</a>
            <span aria-hidden="true"> · </span>
            <a href={config.privacidad_url} target="_blank" rel="noopener noreferrer" className="inline-block py-1 underline underline-offset-2">Política de privacidad ↗</a>
          </div>
          {config.informacion_texto && (
            <label className={consentimientoClase}>
              <input type="checkbox" name="consentimiento_informacion" checked={informacion} onChange={(e) => setInformacion(e.target.checked)} className={checkClase} />
              <span>{config.informacion_texto} <span className="opacity-70">(opcional)</span></span>
            </label>
          )}
          {config.marketing_texto && (
            <label className={consentimientoClase}>
              <input type="checkbox" name="consentimiento_marketing" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className={checkClase} />
              <span>{config.marketing_texto} <span className="opacity-70">(opcional)</span></span>
            </label>
          )}
        </div>
      </fieldset>
      {error && <p role="alert" className="mb-4 mt-3 text-sm text-rose-700">{error}</p>}
      <Accion activacion={activacion} type="submit" disabled={enviando} className="mt-5 min-h-11 py-3 text-sm">{enviando ? "Guardando tu registro…" : activacion ? "Registrarme" : "Registrarme →"}</Accion>
    </form>
  );
}
