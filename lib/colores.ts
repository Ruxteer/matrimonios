// La paleta que edita el organizador son cinco colores. El resto (el hover de
// los botones, el rosa suave, el dorado oscuro) se calcula a partir de ellos:
// así una paleta nueva se ve completa sin pedirle nueve colores a nadie.

const HEX = /^#[0-9a-fA-F]{6}$/;

export function colorValido(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

function componentes(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function aHex(r: number, g: number, b: number): string {
  const dos = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${dos(r)}${dos(g)}${dos(b)}`;
}

export function mezclar(hex: string, hacia: string, cantidad: number): string {
  if (!colorValido(hex) || !colorValido(hacia)) return hex;
  const [r1, g1, b1] = componentes(hex);
  const [r2, g2, b2] = componentes(hacia);
  const m = (a: number, b: number) => a + (b - a) * cantidad;
  return aHex(m(r1, r2), m(g1, g2), m(b1, b2));
}

export const oscurecer = (hex: string, cantidad: number) => mezclar(hex, "#000000", cantidad);
export const aclarar = (hex: string, cantidad: number) => mezclar(hex, "#ffffff", cantidad);

// Luminancia relativa (WCAG) para decidir si encima de un color va texto
// blanco o negro. Con paletas claras el blanco sobre el botón no se lee.
export function luminancia(hex: string): number {
  if (!colorValido(hex)) return 0;
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = componentes(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

// El diseño del producto usa texto blanco sobre el rosa de los botones y así se
// queda: el umbral alto es a propósito, solo se cambia a texto oscuro cuando el
// color elegido es tan claro que el blanco deja de verse.
export function textoSobre(fondo: string): string {
  return luminancia(fondo) > 0.72 ? "#3a3a3a" : "#ffffff";
}
