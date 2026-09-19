import { NextResponse } from "next/server";

// Normalmente o service worker (public/sw.js) intercepta esse POST antes de chegar
// aqui. Esse handler só existe como rede de segurança para o primeiro compartilhamento
// antes do service worker assumir o controle da página — nesse caso o texto passa,
// mas as imagens se perdem (avisamos na tela de Cargas com `semSw=1`).
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const texto = String(form.get("texto") ?? form.get("titulo") ?? "");
    const url = new URL("/", request.url);
    if (texto) url.searchParams.set("texto", texto);
    url.searchParams.set("semSw", "1");
    return NextResponse.redirect(url, 303);
  } catch {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }
}
