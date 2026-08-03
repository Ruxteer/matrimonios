"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import BuscadorMesa from "@/components/BuscadorMesa";
import { NotaPalomas } from "@/components/ui";
import { IconCopas } from "@/components/Icons";

type Resultado = {
  id: number;
  nombre: string;
  mesa: string;
  companions: string[];
};

function MesaContent() {
  const { slug } = useParams<{ slug: string }>();
  const q = useSearchParams().get("q") ?? "";
  const [resultados, setResultados] = useState<Resultado[] | null>(q ? null : []);
  const [elegido, setElegido] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!q) return;
    let vigente = true;
    fetch(`/api/eventos/${slug}/mesa?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: { results?: Resultado[] }) => {
        if (!vigente) return;
        const results = data.results ?? [];
        setResultados(results);
        if (results.length === 1) setElegido(results[0]);
      });
    return () => {
      vigente = false;
    };
  }, [q, slug]);

  if (resultados === null) {
    return <p className="text-center text-sm opacity-50">Buscando…</p>;
  }

  // Sin resultados → invitar a reintentar
  if (!elegido && resultados.length === 0) {
    return (
      <div className="text-center">
        <h2 className="mb-2 font-serif text-2xl font-bold">No te encontramos</h2>
        <p className="mb-6 text-sm opacity-70">
          Revisa que tu nombre esté escrito igual que en la invitación.
        </p>
        <BuscadorMesa slug={slug} boton="Buscar de nuevo" inicial={q} />
      </div>
    );
  }

  // Varias coincidencias → elegir
  if (!elegido) {
    return (
      <div className="text-center">
        <h2 className="mb-2 font-serif text-2xl font-bold">
          Encontramos varios nombres
        </h2>
        <p className="mb-6 text-sm opacity-70">¿Cuál eres tú?</p>
        <div className="space-y-3">
          {resultados.map((r) => (
            <button
              key={r.id}
              onClick={() => setElegido(r)}
              className="w-full rounded-[20px] bg-gris-card px-4 py-3 font-serif text-lg font-bold shadow-sm hover:brightness-95"
            >
              {r.nombre}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-4 font-serif text-lg font-bold">¡Te encontramos!</h2>
      <p className="mb-6 font-serif text-3xl font-bold leading-tight">
        {elegido.nombre}
      </p>

      {elegido.mesa ? (
        <>
          <p className="mb-4 font-serif text-base font-bold">Tu mesa asignada es:</p>
          <div className="mx-auto mb-8 w-full max-w-[256px] rounded-[20px] bg-gris-card px-6 pb-5 pt-6 shadow-sm">
            <IconCopas className="mx-auto mb-2 h-[39px] w-auto" />
            <p className="font-serif text-[72px] font-bold leading-none">
              {elegido.mesa}
            </p>
          </div>
        </>
      ) : (
        <p className="mb-8 text-sm opacity-70">
          Tu mesa aún no está asignada — pregunta en recepción.
        </p>
      )}

      {elegido.companions.length > 0 && (
        <>
          <p className="mb-3 font-serif text-base font-bold">
            Las personas que te acompañan:
          </p>
          <ul className="mx-auto mb-4 w-fit space-y-1.5 text-left text-sm">
            {elegido.companions.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <span className="opacity-40">•</span> {c}
              </li>
            ))}
          </ul>
        </>
      )}

      <NotaPalomas>
        ¡Gracias por ser parte
        <br /> de este día tan especial!
      </NotaPalomas>
    </div>
  );
}

export default function MesaPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm opacity-50">Buscando…</p>}>
      <MesaContent />
    </Suspense>
  );
}
