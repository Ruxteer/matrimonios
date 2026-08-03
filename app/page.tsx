import Link from "next/link";
import { redirect } from "next/navigation";
import { listarEventos, nombreEvento } from "@/lib/eventos";
import { PRODUCTO } from "@/lib/config";

// Portada del producto. Con un solo matrimonio cargado entra directo a él;
// con varios, muestra la lista (cada uno tiene su propia URL y su propio QR).
export default function Portada() {
  const eventos = listarEventos();

  if (eventos.length === 1) redirect(`/${eventos[0].slug}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-8">
      <h1 className="mb-1 font-serif text-2xl font-bold">{PRODUCTO.nombre}</h1>
      <p className="mb-8 text-sm opacity-70">{PRODUCTO.descripcion}</p>

      {eventos.length === 0 ? (
        <div className="rounded-2xl bg-gris-card p-6 text-sm">
          <p className="mb-3 font-medium">Todavía no hay matrimonios creados.</p>
          <Link href="/admin" className="underline">
            Entrar al panel para crear el primero
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {eventos.map((e) => (
            <Link
              key={e.id}
              href={`/${e.slug}`}
              className="block rounded-2xl bg-gris-card p-5 shadow-sm transition hover:brightness-95"
            >
              <p className="font-serif text-lg font-bold">{nombreEvento(e)}</p>
              <p className="text-sm opacity-70">{e.fecha || "sin fecha"}</p>
            </Link>
          ))}
        </div>
      )}

      <Link href="/admin" className="mt-10 text-xs opacity-50 hover:opacity-100">
        Panel de administración
      </Link>
    </main>
  );
}
