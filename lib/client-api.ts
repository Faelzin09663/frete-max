import type { Leg, Local, Oferta } from "./types.ts";
import { comprimirImagens } from "./imagem.ts";
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
/** Chave de um trecho por par de coordenadas (mesma regra usada em lib/rota.ts). */
export const chaveLocais = (a: Local, b: Local) => `${r4(a.lat)},${r4(a.lng)}>${r4(b.lat)},${r4(b.lng)}`;

/** Distância/tempo/pedágio entre dois locais. Guarda no cache: cada par é consultado uma vez só. */
export async function getLeg(a: Local, b: Local): Promise<Leg> {
  if (a.id === b.id) return { km: 0, min: 0, tollRS: 0, estimado: false };
  const cache = lerCache();
  const k = chaveLocais(a, b);
  // estimativas não ficam em cache, para serem refeitas quando a chave do Google for configurada
  if (cache[k] && !cache[k].estimado && cache[k].poly) return cache[k];

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

/**
 * Busca vários trechos de uma vez, sem repetir consulta para o mesmo par de coordenadas.
 * O planejador de rota (lib/rota.ts) testa milhares de ORDENS possíveis para as mesmas
 * cargas, mas todas essas ordens usam os mesmos trechos entre pontos — então aqui cada
 * trecho único é buscado (API ou cache do navegador) uma vez só, e o cálculo das ordens
 * em si não faz nenhuma chamada extra.
 */
export async function getLegsMapa(pares: [Local, Local][]): Promise<Map<string, Leg>> {
  const unicos = new Map<string, [Local, Local]>();
  for (const [a, b] of pares) {
    if (a.id === b.id) continue;
    const k = chaveLocais(a, b);
    if (!unicos.has(k)) unicos.set(k, [a, b]);
  }
  const entradas = [...unicos.entries()];
  const legs = await Promise.all(entradas.map(([, [a, b]]) => getLeg(a, b)));
  const mapa = new Map<string, Leg>();
  entradas.forEach(([k], i) => mapa.set(k, legs[i]));
  return mapa;
}

// ---------------------------------------------------------------------------
// A leitura da IA (Gemini) custa tempo e uma chamada paga. Guarda a resposta em
// memória pelo conteúdo exato (texto + prints): se o motorista sair da tela de
// Cargas — por exemplo pra ajustar o Caminhão — e a mesma mensagem/print for
// analisada de novo, o app reaproveita a resposta em vez de mandar tudo de novo
// pro Gemini. Fica só na memória da aba (não precisa persistir): o objetivo é
// não gastar de novo dentro da mesma sessão, não sobreviver a um fechar de app.
// ---------------------------------------------------------------------------
const cacheExtracao = new Map<string, Omit<Oferta, "id">[]>();

function chaveConteudo(texto: string, imagens: File[]): string {
  const partes = [texto.trim()];
  for (const f of imagens) partes.push(`${f.name}:${f.size}:${f.lastModified}`);
  return partes.join("|");
}

export async function extrairOfertas(texto: string, imagens: File[]): Promise<Oferta[]> {
  const chave = chaveConteudo(texto, imagens);
  const doCache = cacheExtracao.get(chave);
  if (doCache) return doCache.map((o) => ({ ...o, id: novoId() }));

  const fd = new FormData();
  fd.set("texto", texto);
  const comprimidas = await comprimirImagens(imagens);
  comprimidas.forEach((f) => fd.append("imagens", f));
  const r = await fetch("/api/extract", { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? "Erro ao ler a mensagem.");
  const semId: Omit<Oferta, "id">[] = (data.ofertas as Omit<Oferta, "id">[]).map((o) => ({
    ...o,
    carregamentoAte: o.carregamentoAte ?? null,
    descargaAte: o.descargaAte ?? null,
    contato: o.contato ?? null,
  }));
  cacheExtracao.set(chave, semId);
  return semId.map((o) => ({ ...o, id: novoId() }));
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

/** Transforma coordenadas do GPS num endereço legível (geocodificação reversa). */
export async function geocodificarReverso(lat: number, lng: number): Promise<{ lat: number; lng: number; formatado: string }> {
  const r = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? "Não consegui identificar o endereço dessas coordenadas.");
  return data;
}
