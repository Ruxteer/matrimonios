import { redirect } from "next/navigation";

// La portada del producto es la del panel: "Bienvenido a Venito" con los
// clientes (Figma "quick-wins"). Antes listaba todos los eventos en público;
// los invitados nunca pasan por aquí, entran directo a /<evento> con el QR.
export default function Portada() {
  redirect("/admin");
}
