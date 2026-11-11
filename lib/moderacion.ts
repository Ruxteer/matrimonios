// Estados de lo que mandan los participantes y que puede pasar por revisión
// antes de salir en la pantalla: fotos y mensajes.
export const ESTADOS_MODERACION = ["pendiente", "aprobada", "rechazada"] as const;
export type EstadoModeracion = (typeof ESTADOS_MODERACION)[number];
