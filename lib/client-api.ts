import type { Leg, Local, Oferta } from "./types.ts";
import { chaveEntrada, gravarCacheIA, lerCacheIA, type OfertaBruta } from "./cache-ia.ts";
import { chaveLeg } from "./geo.ts";
import { comprimirImagens } from "./imagem.ts";
import { novoId } from "./storage.ts";

// ---------------------------------------------------------------------------
// Rotas: cada trecho A→B é consultado ao Google uma única vez.
//  1) memória da sessão      (instantâneo; inclui estimativas)
//  2) localStorage           (60 dias, até 400 trechos)
//  3) Google Routes          (só se não estiver em nenhum dos dois)
// Pedidos iguais feitos ao mesmo tempo viram um só.
// ---------------------------------------------------------------------------

const CACHE_KEY = "fretemax:rotas";
const VALIDADE_MS = 60 * 24 * 3600 * 1000;
const MAX_TRECHOS = 400;

type Registro = { leg: Leg; t: number };
const ZERO: Leg = { km: 0, min: 0, tollRS: 0, estimado: false };

const memoria = new Map<string, Leg>();
const emVoo = new Map<string, Promise<Leg>>();
let persistido: Map<string, Registro> | null = null;
let timerGravar: ReturnType<typeof setTimeout> | null = null;

function carregar(): Map<string, Registro> {
  if (persistido) return persistido;
  persistido = new Map();
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, Registro | Leg>;
    for (const [k, v] of Object.entries(raw)) {
      // formato antigo guardava o Leg direto, sem data: aceita e carimba agora
      if (v && typeof v === "object" && "leg" in v) persistido.set(k, v as Registro);
      else if (v && typeof v === "object" && "km" in v) persistido.set(k, { leg: v as Leg, t: Date.now() });
    }
  } catch {
    /* cache corrompido: começa vazio */
  }
  return persistido;
}

function agendarGravacao() {
  if (timerGravar) return;
  timerGravar = setTimeout(() => {
    timerGravar = null;
    const mapa = carregar();
    const agora = Date.now();
    const vivos = [...mapa.entries()].filter(([, r]) => agora - r.t <= VALIDADE_MS);
    vivos.sort((a, b) => b[1].t - a[1].t);
    const cortados = vivos.slice(0, MAX_TRECHOS);
    persistido = new Map(cortados);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cortados)));
    } catch {
      /* sem espaço: continua só com a memória */
    }
  }, 400);
}

/** Distância/tempo/pedágio entre dois locais, com cache. */
export async function getLeg(a: Local, b: Local): Promise<Leg> {
  if (a.id === b.id) return ZERO;
  const k = chaveLeg(a, b);

  const naMemoria = memoria.get(k);
  if (naMemoria) return naMemoria;

  const guardado = carregar().get(k);
  // estimativa nunca fica em disco (para ser refeita quando a chave do Google for configurada)
  if (guardado && !guardado.leg.estimado && guardado.leg.poly && Date.now() - guardado.t <= VALIDADE_MS) {
    memoria.set(k, guardado.leg);
    return guardado.leg;
  }

  const pendente = emVoo.get(k);
  if (pendente) return pendente;

  const p = (async () => {
    const r = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origem: { lat: a.lat, lng: a.lng }, destino: { lat: b.lat, lng: b.lng } }),
    });
    if (!r.ok) throw new Error("Falha ao calcular a rota.");
    const leg = (await r.json()) as Leg;
    memoria.set(k, leg);
    if (!leg.estimado) {
      carregar().set(k, { leg, t: Date.now() });
      agendarGravacao();
    }
    return leg;
  })();
  emVoo.set(k, p);
  try {
    return await p;
  } finally {
    emVoo.delete(k);
  }
}

/** Quantos trechos reais estão guardados (para mostrar na tela de conta/ajustes). */
export function totalTrechosEmCache(): number {
  return carregar().size;
}

export function limparCacheRotas() {
  memoria.clear();
  persistido = new Map();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignora */
  }
}

// ---------------------------------------------------------------------------
// IA: lê as ofertas de um texto/print. Entrada repetida = resposta guardada.
// ---------------------------------------------------------------------------

export async function extrairOfertasComInfo(
  texto: string,
  imagens: File[],
): Promise<{ ofertas: Oferta[]; doCache: boolean }> {
  const chave = await chaveEntrada(texto, imagens);
  const guardado = lerCacheIA(chave);
  if (guardado) {
    return { ofertas: guardado.map((o) => ({ ...o, id: novoId() })), doCache: true };
  }

  const fd = new FormData();
  fd.set("texto", texto);
  const comprimidas = await comprimirImagens(imagens);
  comprimidas.forEach((f) => fd.append("imagens", f));
  const r = await fetch("/api/extract", { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? "Erro ao ler a mensagem.");

  const brutas = (data.ofertas as Omit<Oferta, "id">[]).map((o) => ({
    ...o,
    carregamentoAte: o.carregamentoAte ?? null,
    descargaAte: o.descargaAte ?? null,
    contato: o.contato ?? null,
  })) as OfertaBruta[];
  gravarCacheIA(chave, brutas);
  return { ofertas: brutas.map((o) => ({ ...o, id: novoId() })), doCache: false };
}

export async function extrairOfertas(texto: string, imagens: File[]): Promise<Oferta[]> {
  return (await extrairOfertasComInfo(texto, imagens)).ofertas;
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
