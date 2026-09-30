// Comprueba la firma del archivo, además del tipo declarado por el navegador.
// SVG y documentos renombrados no se aceptan como imágenes.
export function firmaImagenValida(bytes: Uint8Array, tipo: string): boolean {
  const coincide = (firma: number[], desde = 0) =>
    firma.every((byte, i) => bytes[desde + i] === byte);
  const texto = (desde: number, largo: number) =>
    String.fromCharCode(...bytes.slice(desde, desde + largo));

  switch (tipo) {
    case "image/jpeg":
      return coincide([0xff, 0xd8, 0xff]);
    case "image/png":
      return coincide([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return ["GIF87a", "GIF89a"].includes(texto(0, 6));
    case "image/webp":
      return texto(0, 4) === "RIFF" && texto(8, 4) === "WEBP";
    case "image/heic":
    case "image/heif": {
      if (bytes.length < 16 || texto(4, 4) !== "ftyp") return false;
      const marcas = [texto(8, 4)];
      // Las marcas compatibles comienzan después de la versión menor.
      for (let i = 16; i + 4 <= bytes.length; i += 4) marcas.push(texto(i, 4));
      return marcas.some((marca) =>
        ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(marca)
      );
    }
    default:
      return false;
  }
}
