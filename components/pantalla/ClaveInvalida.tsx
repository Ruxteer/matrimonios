// Lo que ve quien abre una pantalla proyectada sin la clave de la dirección.
export default function ClaveInvalida() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Esta dirección no es válida</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        Las pantallas en vivo se abren con el enlace «Ver pantalla» del panel del evento.
      </p>
    </main>
  );
}
