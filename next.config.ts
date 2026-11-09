import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transiciones entre páginas con <ViewTransition> de React (el punto del
  // mapa que se transforma en la ficha de su zona). Solo se anima lo que está
  // envuelto en <ViewTransition>; el resto de las páginas cambia como siempre.
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
