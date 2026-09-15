import Image from "next/image";
import type { Evento } from "@/lib/db";
import { urlArchivo } from "@/lib/urls";
import { COLORES } from "@/lib/config";
import { aclarar, colorValido, oscurecer, textoSobre } from "@/lib/colores";

const color = (v: string, porDefecto: string) => (colorValido(v) ? v : porDefecto);

// Los colores del matrimonio se inyectan como variables CSS: el resto de la
// interfaz ya usa bg-rosa, bg-gris-card, etc. Los tonos derivados (hover, rosa
// suave, dorado oscuro) se calculan aquí para que cualquier paleta que elija el
// organizador quede completa, y el color del texto de los botones se decide por
// contraste: con una paleta clara el blanco no se lee.
export function ColoresEvento({ evento }: { evento: Evento }) {
  const boton = color(evento.color_rosa, COLORES.rosa);
  const dorado = color(evento.color_dorado, COLORES.dorado);
  const css = `:root{
    --background:${color(evento.color_fondo, COLORES.fondo)};
    --foreground:${color(evento.color_texto, COLORES.texto)};
    --rosa:${boton};
    --rosa-hover:${oscurecer(boton, 0.12)};
    --rosa-footer:${boton};
    --rosa-suave:${aclarar(boton, 0.72)};
    --rosa-texto:${textoSobre(boton)};
    --gris-card:${color(evento.color_card, COLORES.card)};
    --dorado:${dorado};
    --dorado-oscuro:${oscurecer(dorado, 0.18)};
  }`;
  return <style>{css}</style>;
}

function TextoEncabezado({
  evento,
  posiciones,
}: {
  evento: Evento;
  posiciones: { titulo: string; nombres: string; fecha: string; escalas: [string, string, string] };
}) {
  const [tTitulo, tNombres, tFecha] = posiciones.escalas;
  const dorado = color(evento.color_dorado, COLORES.dorado);
  return (
    <div className="absolute inset-0" style={{ color: dorado }}>
      <p
        className="absolute inset-x-0 text-center font-serif font-bold"
        style={{ top: posiciones.titulo, fontSize: tTitulo, letterSpacing: "0.08em" }}
      >
        Matrimonio de
      </p>
      <p
        className="absolute inset-x-0 text-center font-script leading-none"
        style={{ top: posiciones.nombres, fontSize: tNombres }}
      >
        {evento.nombre1}
        <span style={{ fontSize: "0.55em" }}> y </span>
        {evento.nombre2}
      </p>
      {evento.fecha && (
        <p
          className="absolute inset-x-0 text-center font-serif font-bold"
          style={{ top: posiciones.fecha, fontSize: tFecha, letterSpacing: "0.14em" }}
        >
          {evento.fecha}
        </p>
      )}
    </div>
  );
}

// Banner propio subido desde el panel. Con <picture> el celular descarga solo
// su imagen y no también la de escritorio. El texto se mide contra el alto de
// la imagen que quedó (cqh), así sirve para cualquier proporción que suban.
function BannerPropio({
  evento,
  movil,
  escritorio,
  alt,
}: {
  evento: Evento;
  movil: string;
  escritorio: string;
  alt: string;
}) {
  return (
    <div className="relative overflow-hidden">
      <picture>
        {/* 768px es el corte md de Tailwind, el mismo que usa el marco por defecto. */}
        {escritorio !== movil && <source media="(min-width: 768px)" srcSet={escritorio} />}
        <img src={movil} alt={alt} className="block w-full" />
      </picture>
      {evento.banner_texto === 1 && (
        <div className="absolute inset-0" style={{ containerType: "size" }}>
          <div
            className="flex h-full flex-col items-center justify-center px-[6%] text-center"
            style={{ color: color(evento.color_dorado, COLORES.dorado) }}
          >
            <p
              className="font-serif font-bold"
              style={{ fontSize: "8cqh", letterSpacing: "0.08em" }}
            >
              Matrimonio de
            </p>
            <p className="font-script leading-none" style={{ fontSize: "34cqh" }}>
              {evento.nombre1}
              <span style={{ fontSize: "0.55em" }}> y </span>
              {evento.nombre2}
            </p>
            {evento.fecha && (
              <p
                className="font-serif font-bold"
                style={{ fontSize: "12cqh", letterSpacing: "0.14em" }}
              >
                {evento.fecha}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EventHeader({ evento }: { evento: Evento }) {
  const conTexto = evento.banner_texto === 1;
  const alt = `Matrimonio de ${evento.nombre1} y ${evento.nombre2}${
    evento.fecha ? `, ${evento.fecha}` : ""
  }`;

  // Un banner para pantallas anchas y otro para el celular, porque la misma
  // imagen no queda bien en las dos proporciones. Si subieron uno solo, ese
  // sirve para todo.
  const escritorio = urlArchivo(evento.banner || evento.banner_movil);
  const movil = urlArchivo(evento.banner_movil || evento.banner);

  if (escritorio) {
    return (
      <header className="relative bg-white">
        <BannerPropio evento={evento} movil={movil} escritorio={escritorio} alt={alt} />
      </header>
    );
  }

  // Marco por defecto del producto (sin nombres: van como texto encima).
  return (
    <header className="relative bg-white">
      <div className="relative @container md:hidden">
        <Image
          src="/design/marco-movil.png"
          alt=""
          width={1236}
          height={601}
          priority
          className="w-full"
        />
        {conTexto && (
          <TextoEncabezado
            evento={evento}
            posiciones={{
              titulo: "14%",
              nombres: "23%",
              fecha: "71%",
              escalas: ["3.2cqw", "13cqw", "5.4cqw"],
            }}
          />
        )}
      </div>
      <div className="relative @container hidden md:block">
        <Image
          src="/design/marco-escritorio.png"
          alt=""
          width={2880}
          height={400}
          priority
          className="w-full"
        />
        {conTexto && (
          <TextoEncabezado
            evento={evento}
            posiciones={{
              titulo: "13%",
              nombres: "27%",
              fecha: "74%",
              escalas: ["1.2cqw", "4.6cqw", "1.7cqw"],
            }}
          />
        )}
      </div>
    </header>
  );
}

export function EventFooter() {
  return (
    <footer className="mt-auto bg-rosa-footer px-6 py-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/design/footer-texto.svg"
        alt="Disfruta cada momento"
        className="mx-auto h-[22px] w-auto"
      />
    </footer>
  );
}

export default function EventShell({
  evento,
  children,
}: {
  evento: Evento;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <ColoresEvento evento={evento} />
      <EventHeader evento={evento} />
      <main className="mx-auto w-full max-w-md flex-1 px-6 pb-12 pt-6">{children}</main>
      <EventFooter />
    </div>
  );
}
