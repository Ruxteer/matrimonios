// Identificador local del teléfono del invitado. Sirve para no dejar votar o
// responder dos veces desde el mismo aparato sin pedirle nombre ni clave a
// nadie: es un número al azar guardado en el navegador, no identifica personas.

const CLAVE = "matrimonio-sesion";

export function sesionInvitado(): string {
  if (typeof window === "undefined") return "";
  try {
    const guardada = window.localStorage.getItem(CLAVE);
    if (guardada) return guardada;
    const nueva = crypto.randomUUID();
    window.localStorage.setItem(CLAVE, nueva);
    return nueva;
  } catch {
    // Navegación privada o almacenamiento bloqueado: se pierde el control de
    // repetidos, pero el invitado igual puede participar.
    return "";
  }
}
