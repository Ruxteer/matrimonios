import type { Metadata } from "next";
import { Roboto, Gelasio, Allura } from "next/font/google";
import "./globals.css";
import { PRODUCTO } from "@/lib/config";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Gelasio es métricamente compatible con Georgia: se usa de respaldo
// en dispositivos sin Georgia (p. ej. Android).
const gelasio = Gelasio({
  variable: "--font-gelasio",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Caligrafía de los nombres en el encabezado.
const allura = Allura({
  variable: "--font-allura",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: PRODUCTO.nombre,
  description: PRODUCTO.descripcion,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${roboto.variable} ${gelasio.variable} ${allura.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
