"use client";

/**
 * Reduz a imagem no navegador antes de enviar pro servidor (a mensagem só
 * precisa ficar legível). Importante no celular, com internet do plano de dados.
 * Se algo falhar, devolve o arquivo original.
 */
export async function comprimirImagem(file: File, maxLado = 1600, qualidade = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size < 500_000) return file; // já é pequena, não vale a pena reprocessar
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    if ("close" in bitmap) bitmap.close();
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function comprimirImagens(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => comprimirImagem(f)));
}
