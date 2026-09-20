"use client";
import type { Oferta } from "./types.ts";

/**
 * Memória das leituras da IA. Se o motorista manda de novo exatamente a mesma mensagem
 * (ou o mesmo print), a resposta guardada é reaproveitada e o Gemini nem é chamado.
 * A chave é um SHA-256 do texto (sem diferença de espaços/maiúsculas) + o conteúdo dos prints.
 */

const KEY = "fretemax:ia-cache";
const VALIDADE_MS = 14 * 24 * 3600 * 1000; // 14 dias: cargas mudam rápido
const MAX_ENTRADAS = 40;

export type OfertaBruta = Omit<Oferta, "id" | "valorManual" | "pedagioManualRS">;
type Entrada = { t: number; ofertas: OfertaBruta[] };
type Store = Record<string, Entrada>;

function ler(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function gravar(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem espaço: segue sem cache */
  }
}

async function sha256(dados: BufferSource): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", dados);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chave da entrada, ou null se o navegador não suporta (aí simplesmente não usa cache). */
export async function chaveEntrada(texto: string, imagens: File[]): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const partes = [texto.toLowerCase().replace(/\s+/g, " ").trim()];
    for (const f of imagens) partes.push(await sha256(await f.arrayBuffer()));
    return await sha256(new TextEncoder().encode(partes.join("\u0001")));
  } catch {
    return null;
  }
}

export function lerCacheIA(chave: string | null): OfertaBruta[] | null {
  if (!chave) return null;
  const e = ler()[chave];
  if (!e || Date.now() - e.t > VALIDADE_MS) return null;
  return e.ofertas;
}

export function gravarCacheIA(chave: string | null, ofertas: OfertaBruta[]) {
  if (!chave || ofertas.length === 0) return; // não guarda leitura vazia (pode ter sido falha)
  const s = ler();
  const agora = Date.now();
  s[chave] = { t: agora, ofertas };
  // poda: tira vencidas e, se passar do limite, as mais antigas
  const validas = Object.entries(s).filter(([, v]) => agora - v.t <= VALIDADE_MS);
  validas.sort((a, b) => b[1].t - a[1].t);
  gravar(Object.fromEntries(validas.slice(0, MAX_ENTRADAS)));
}

export function limparCacheIA() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
