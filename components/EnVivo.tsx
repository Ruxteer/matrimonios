// Indicador "EN VIVO" de las pantallas proyectadas: rojo, con el punto blanco
// que late. Va igual en fotos y mensajes, votaciones y sorteos.
export default function EnVivo({ className = "" }: { className?: string }) {
  return (
    <p
      role="status"
      aria-label="En vivo"
      className={`flex items-center gap-[1vh] rounded-[1.2vh] bg-[#c8102e] px-[1.8vh] py-[.9vh] font-sans text-[2.4vh] font-extrabold uppercase leading-none tracking-[.08em] text-white shadow-lg ${className}`}
    >
      En vivo
      <span aria-hidden className="relative flex h-[1.8vh] w-[1.8vh]">
        <span className="en-vivo-pulso absolute inset-0 rounded-full bg-white" />
        <span className="relative h-full w-full rounded-full bg-white" />
      </span>
    </p>
  );
}
