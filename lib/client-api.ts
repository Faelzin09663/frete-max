import type { Leg, Local, Oferta } from "./types.ts";
import { novoId } from "./storage.ts";

const CACHE_KEY = "fretemax:rotas";

function lerCache(): Record<string, Leg> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

const r4 = (n: number) => n.toFixed(4);
const chave = (a: Local, b: Local) => `${r4(a.lat)},${r4(a.lng)}>${r4(b.lat)},${r4(b.lng)}`;

/** Distância/tempo/pedágio entre dois locais. Guarda no cache: cada par é consultado uma vez só. */
export async function getLeg(a: Local, b: Local): Promise<Leg> {
  if (a.id === b.id) return { km: 0, min: 0, tollRS: 0, estimado: false };
  const cache = lerCache();
  const k = chave(a, b);
  // estimativas não ficam em cache, para serem refeitas quando a chave do Google for configurada
  if (cache[k] && !cache[k].estimado) return cache[k];

  const r = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origem: { lat: a.lat, lng: a.lng }, destino: { lat: b.lat, lng: b.lng } }),
  });
  if (!r.ok) throw new Error("Falha ao calcular a rota.");
  const leg = (await r.json()) as Leg;
  if (!leg.estimado) {
    cache[k] = leg;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* ignora */
    }
  }
  return leg;
}

export async function extrairOfertas(texto: string, imagens: File[]): Promise<Oferta[]> {
  const fd = new FormData();
  fd.set("texto", texto);
  imagens.forEach((f) => fd.append("imagens", f));
  const r = await fetch("/api/extract", { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? "Erro ao ler a mensagem.");
  return (data.ofertas as Omit<Oferta, "id">[]).map((o) => ({
    ...o,
    carregamentoAte: o.carregamentoAte ?? null,
    descargaAte: o.descargaAte ?? null,
    contato: o.contato ?? null,
    id: novoId(),
  }));
}

export async function geocodificar(endereco: string): Promise<{ lat: number; lng: number; formatado: string }> {
  const r = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endereco }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? "Não consegui localizar o endereço.");
  return data;
}
