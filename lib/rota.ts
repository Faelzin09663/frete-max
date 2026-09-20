import type { Leg, Local, Oferta, Truck, Viabilidade } from "./types.ts";
import { parseHora, valorEfetivo } from "./calc.ts";

/** Uma carga já com origem/destino cadastrados (pronta para entrar numa sequência). */
export type ParadaCarga = {
  oferta: Oferta;
  origem: Local;
  destino: Local;
};

/** Um trecho carregado dentro de uma sequência, com o trecho vazio que leva até ele. */
export type EtapaRota = {
  oferta: Oferta;
  origem: Local;
  destino: Local;
  vazio: Leg; // de onde estava (posição ou carga anterior) até esta origem
  cheio: Leg;
  chegadaOrigemMin: number | null; // horário estimado de chegada na origem (min desde 0h)
  viabilidade: Viabilidade;
  margemMin: number | null;
};

export type Sequencia = {
  etapas: EtapaRota[];
  retorno: Leg | null; // último destino -> base, se houver
  receitaRS: number;
  dieselRS: number;
  manutencaoRS: number;
  pedagioRS: number;
  custoTotalRS: number;
  lucroRS: number;
  kmVazio: number;
  kmCheio: number;
  kmTotal: number;
  pctVazio: number; // 0..1
  horas: number;
  lucroPorHoraRS: number;
  viabilidade: Viabilidade; // a pior entre as etapas
  avisos: string[];
};

export type ResultadoRotas = {
  melhores: Sequencia[]; // até 3, já ordenadas pelo critério escolhido
  foraDaRota: ParadaCarga[]; // cargas que não entraram na melhor sequência
  combinacoesTestadas: number;
  maxParadasUsado: number; // pode ser menor que o pedido, se muitas cargas exigirem cortar por desempenho
  prazoRespeitado: boolean; // false = nenhuma sequência coube no prazo pedido; mostrou mesmo assim
};

const ZERO: Leg = { km: 0, min: 0, tollRS: 0, estimado: false };
const r4 = (n: number) => n.toFixed(4);

/** Mesma chave usada por getLegsMapa em lib/client-api.ts: um trecho por par de coordenadas. */
export function chaveTrecho(a: Local, b: Local): string {
  return `${r4(a.lat)},${r4(a.lng)}>${r4(b.lat)},${r4(b.lng)}`;
}

/**
 * Todos os pares de coordenadas que a sequência pode precisar, uma única vez cada:
 * posição -> origem de cada carga, o trecho cheio de cada carga, destino -> base,
 * e destino de uma carga -> origem de outra (para encadear). O mesmo par nunca se repete
 * aqui, então getLegsMapa consulta a API (ou o cache do navegador) só uma vez por trecho,
 * não uma vez por ordem testada.
 */
export function paresParaSequencia(pos: Local, paradas: ParadaCarga[], base: Local | null): [Local, Local][] {
  const pares: [Local, Local][] = [];
  for (const p of paradas) {
    pares.push([pos, p.origem]);
    pares.push([p.origem, p.destino]);
    if (base) pares.push([p.destino, base]);
  }
  for (const a of paradas) {
    for (const b of paradas) {
      if (a === b) continue;
      pares.push([a.destino, b.origem]);
    }
  }
  return pares;
}

function buscarLeg(legs: Map<string, Leg>, a: Local, b: Local): Leg {
  if (a.id === b.id) return ZERO;
  return legs.get(chaveTrecho(a, b)) ?? { ...ZERO, estimado: true };
}

const PESO_VIAB: Record<Viabilidade, number> = { OK: 0, DESCONHECIDA: 1, ARRISCADO: 2, INVIAVEL: 3 };
const piorViab = (a: Viabilidade, b: Viabilidade): Viabilidade => (PESO_VIAB[b] > PESO_VIAB[a] ? b : a);

/** Calcula o resultado financeiro e de tempo de UMA ordem específica de cargas. */
export function avaliarSequencia(
  paradas: ParadaCarga[],
  truck: Truck,
  toneladas: number,
  pos: Local,
  base: Local | null,
  legs: Map<string, Leg>,
  agoraMin: number | null,
): Sequencia {
  const etapas: EtapaRota[] = [];
  const avisos: string[] = [];
  let atual = pos;
  let relogio = agoraMin;
  let receitaRS = 0;
  let kmVazio = 0;
  let kmCheio = 0;
  let tollVazio = 0;
  let tollCheio = 0;
  let minDirigindo = 0;
  let viabilidadeGeral: Viabilidade = "DESCONHECIDA";

  for (const parada of paradas) {
    const vazio = buscarLeg(legs, atual, parada.origem);
    const cheio = buscarLeg(legs, parada.origem, parada.destino);
    const valor = valorEfetivo(parada.oferta);
    const unidade = valor != null && parada.oferta.unidade === "DESCONHECIDA" ? "TONELADA" : parada.oferta.unidade;
    receitaRS += valor == null ? 0 : unidade === "VIAGEM" ? valor : valor * toneladas;

    kmVazio += vazio.km;
    kmCheio += cheio.km;
    tollVazio += vazio.tollRS;
    const tollDoTrechoCheio = parada.oferta.pedagioManualRS ?? cheio.tollRS;
    if (parada.oferta.pedagio !== "REEMBOLSADO") tollCheio += tollDoTrechoCheio;
    minDirigindo += vazio.min + cheio.min;

    let chegadaOrigemMin: number | null = null;
    let margemMin: number | null = null;
    let viabEtapa: Viabilidade = "DESCONHECIDA";
    if (relogio != null) {
      chegadaOrigemMin = relogio + vazio.min * truck.fatorTempo;
      const limite = parseHora(parada.oferta.carregamentoAte);
      if (limite != null) {
        margemMin = Math.round(limite - chegadaOrigemMin);
        viabEtapa = margemMin < 0 ? "INVIAVEL" : margemMin < 30 ? "ARRISCADO" : "OK";
      }
      relogio = chegadaOrigemMin + truck.tempoCargaH * 60 + cheio.min * truck.fatorTempo + truck.tempoDescargaH * 60;
    }
    viabilidadeGeral = piorViab(viabilidadeGeral, viabEtapa);

    etapas.push({ oferta: parada.oferta, origem: parada.origem, destino: parada.destino, vazio, cheio, chegadaOrigemMin, viabilidade: viabEtapa, margemMin });
    atual = parada.destino;
  }

  let retorno: Leg | null = null;
  if (base) {
    retorno = buscarLeg(legs, atual, base);
    kmVazio += retorno.km;
    tollVazio += retorno.tollRS;
    minDirigindo += retorno.min;
  }

  const kmTotal = kmVazio + kmCheio;
  const dieselRS = (kmCheio / truck.consumoCheioKmL + kmVazio / truck.consumoVazioKmL) * truck.dieselRSL;
  const manutencaoRS = kmTotal * truck.custoKmRS;
  const pedagioRS = tollVazio + tollCheio;
  const custoTotalRS = dieselRS + manutencaoRS + pedagioRS;
  const lucroRS = receitaRS - custoTotalRS;
  const horas = (minDirigindo * truck.fatorTempo) / 60 + etapas.length * (truck.tempoCargaH + truck.tempoDescargaH);

  if (truck.consumoCheioKmL <= 0 || truck.consumoVazioKmL <= 0) {
    avisos.push("⚠️ Consumo zerado no caminhão. Confira em Caminhão > Consumo.");
  }
  const semValor = etapas.filter((e) => valorEfetivo(e.oferta) == null).length;
  if (semValor > 0) avisos.push(`⚠️ ${semValor} carga(s) da sequência sem frete definido: preencha antes de decidir.`);
  const estimado = etapas.some((e) => e.vazio.estimado || e.cheio.estimado) || !!retorno?.estimado;
  if (estimado) avisos.push("Distâncias estimadas (sem Google Maps) em pelo menos um trecho.");
  if (horas > 60) avisos.push("⚠️ Sequência com mais de 60h. Considere menos cargas ou verifique os locais.");

  return {
    etapas,
    retorno,
    receitaRS,
    dieselRS,
    manutencaoRS,
    pedagioRS,
    custoTotalRS,
    lucroRS,
    kmVazio,
    kmCheio,
    kmTotal,
    pctVazio: kmTotal > 0 ? kmVazio / kmTotal : 0,
    horas,
    lucroPorHoraRS: horas > 0 ? lucroRS / horas : 0,
    viabilidade: viabilidadeGeral,
    avisos,
  };
}

/**
 * Corta o tamanho máximo da sequência se o número de ordens a testar (permutações
 * P(n,k) somadas de k=1 até o pedido) passar de um orçamento de cálculo — assim o navegador
 * nunca trava, mesmo colando muitas propostas de uma vez.
 */
function paradasViaveis(n: number, desejado: number): number {
  const ORCAMENTO = 60000;
  let soma = 0;
  let termo = 1;
  let k = 0;
  for (k = 1; k <= Math.min(desejado, n); k++) {
    termo *= n - k + 1;
    soma += termo;
    if (soma > ORCAMENTO) return Math.max(1, k - 1);
  }
  return Math.min(desejado, n);
}

/** Testa as ordens possíveis das cargas (até `maxParadas` por sequência) e devolve as melhores. */
export function gerarSequencias(opts: {
  paradas: ParadaCarga[];
  truck: Truck;
  toneladas: number;
  pos: Local;
  base: Local | null;
  legs: Map<string, Leg>;
  agoraMin: number | null;
  maxParadas: number;
  ordenarPor: "LUCRO" | "HORA";
  prazoHoras?: number | null;
}): ResultadoRotas {
  const { paradas, truck, toneladas, pos, base, legs, agoraMin, ordenarPor, prazoHoras } = opts;
  const n = paradas.length;
  if (n === 0) {
    return { melhores: [], foraDaRota: [], combinacoesTestadas: 0, maxParadasUsado: 0, prazoRespeitado: true };
  }

  const k = Math.max(1, paradasViaveis(n, opts.maxParadas));
  const resultados: Sequencia[] = [];
  const usado = new Array(n).fill(false);
  const atual: number[] = [];

  function backtrack() {
    if (atual.length >= 1) {
      const selecionadas = atual.map((i) => paradas[i]);
      resultados.push(avaliarSequencia(selecionadas, truck, toneladas, pos, base, legs, agoraMin));
    }
    if (atual.length === k) return;
    for (let i = 0; i < n; i++) {
      if (usado[i]) continue;
      usado[i] = true;
      atual.push(i);
      backtrack();
      atual.pop();
      usado[i] = false;
    }
  }
  backtrack();

  const chave = (s: Sequencia) => (ordenarPor === "HORA" ? s.lucroPorHoraRS : s.lucroRS);
  const dentroDoPrazo = (s: Sequencia) => prazoHoras == null || s.horas <= prazoHoras;

  let candidatas = resultados.filter(dentroDoPrazo);
  const prazoRespeitado = candidatas.length > 0 || prazoHoras == null;
  if (candidatas.length === 0) candidatas = resultados;

  candidatas.sort((a, b) => {
    const ia = a.viabilidade === "INVIAVEL" ? 1 : 0;
    const ib = b.viabilidade === "INVIAVEL" ? 1 : 0;
    return ia - ib || chave(b) - chave(a);
  });

  const melhores = candidatas.slice(0, 3);
  const idsNaMelhor = new Set(melhores[0]?.etapas.map((e) => e.oferta.id) ?? []);
  const foraDaRota = paradas.filter((p) => !idsNaMelhor.has(p.oferta.id));

  return { melhores, foraDaRota, combinacoesTestadas: resultados.length, maxParadasUsado: k, prazoRespeitado };
}
