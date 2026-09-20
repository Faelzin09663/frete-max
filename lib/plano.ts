import { calcular, parseHora } from "./calc.ts";
import { fmtHoras, fmtRS0 } from "./format.ts";
import { chaveLeg, estimarLeg } from "./geo.ts";
import type { CalcResult, Leg, Local, Oferta, Truck, Viabilidade } from "./types.ts";

/**
 * Planejador de sequência: casa → carga → carga → ... → casa.
 *
 * Testa todas as ordens possíveis de até `maxCargas` cargas (com 10 propostas e 3 cargas
 * são ~800 combinações, com 4 são ~5.800: milissegundos). O relógio anda carga a carga
 * para respeitar o "carregamento até HH:MM" de cada uma.
 *
 * Para não gastar rota do Google à toa, a busca roda primeiro com distâncias estimadas
 * (grátis) e só as melhores sequências recebem a distância real (ver planejarRefinando).
 */

export type Carga = { oferta: Oferta; origem: Local; destino: Local };
export type Objetivo = "HORA" | "LUCRO";
export type LegFn = (a: Local, b: Local) => Leg;

export type OpcoesPlano = {
  inicio: Local; // de onde sai (casa/base ou posição atual)
  fim: Local | null; // onde termina (casa). null = não conta a volta
  cargas: Carga[];
  truck: Truck;
  toneladas: number;
  inicioMin: number | null; // hora de saída (min desde 00:00). null = ignora horários
  maxCargas: number; // 1..5
  objetivo: Objetivo;
  prazoH: number | null; // tempo total máximo (h) até chegar no fim. null = sem limite
  top: number; // quantos planos devolver
};

export type Passo = {
  carga: Carga;
  de: Local; // de onde vem (saída ou destino da carga anterior)
  vazio: Leg;
  cheio: Leg;
  calc: CalcResult; // desta carga, sem a volta final
  chegadaMin: number | null; // relógio ao chegar na origem
  descargaMin: number | null; // relógio ao terminar de descarregar
  margemMin: number | null;
  viabilidade: Viabilidade;
};

export type Plano = {
  passos: Passo[];
  inicio: Local;
  fim: Local | null;
  retorno: Leg | null; // último destino -> fim
  receitaRS: number;
  dieselRS: number;
  manutencaoRS: number;
  pedagioRS: number;
  custoTotalRS: number;
  lucroRS: number;
  kmVazio: number;
  kmCheio: number;
  kmTotal: number;
  pctVazio: number;
  horas: number;
  lucroPorHoraRS: number;
  saidaMin: number | null;
  fimMin: number | null;
  viabilidade: Viabilidade;
  estimado: boolean;
  avisos: string[];
  score: number;
  // preenchidos por anotar()
  titulo: string;
  motivos: string[];
  explicacao: string[];
};

const ZERO: Leg = { km: 0, min: 0, tollRS: 0, estimado: false };

function custoRetorno(leg: Leg, t: Truck) {
  return {
    diesel: (leg.km / t.consumoVazioKmL) * t.dieselRSL,
    manut: leg.km * t.custoKmRS,
    pedagio: leg.tollRS,
  };
}

/** Todas as sequências viáveis, da melhor para a pior (sem texto explicativo). */
export function planejar(o: OpcoesPlano, legBruto: LegFn): Plano[] {
  const { cargas, truck, toneladas, inicio, fim } = o;
  const n = cargas.length;
  const max = Math.min(Math.max(Math.floor(o.maxCargas), 1), 5, n);
  const fator = truck.fatorTempo;
  const leg: LegFn = (a, b) => (a.id === b.id ? ZERO : legBruto(a, b));

  // uma carga saindo de um ponto: resultado guardado (evita recalcular em cada combinação)
  const memo = new Map<string, { vazio: Leg; cheio: Leg; calc: CalcResult }>();
  const par = (prev: Local, i: number) => {
    const k = `${prev.id}|${i}`;
    let v = memo.get(k);
    if (!v) {
      const c = cargas[i];
      const vazio = leg(prev, c.origem);
      const cheio = leg(c.origem, c.destino);
      v = { vazio, cheio, calc: calcular({ oferta: c.oferta, truck, toneladas, vazio, cheio, retorno: null, agoraMin: null }) };
      memo.set(k, v);
    }
    return v;
  };

  type Acc = { receita: number; custo: number; horas: number };
  const cands: { seq: number[]; score: number; lucro: number }[] = [];
  const usados: boolean[] = new Array(n).fill(false);
  const seq: number[] = [];

  function dfs(prev: Local, t: number | null, acc: Acc) {
    for (let i = 0; i < n; i++) {
      if (usados[i]) continue;
      const { vazio, cheio, calc } = par(prev, i);
      const c = cargas[i];

      let t1 = t;
      if (t != null) {
        const chegada = t + vazio.min * fator;
        const lim = parseHora(c.oferta.carregamentoAte);
        // só confere janelas no mesmo dia; depois da meia-noite não dá para saber o dia da oferta
        if (lim != null && chegada < 1440 && chegada > lim) continue;
        t1 = chegada + (truck.tempoCargaH + truck.tempoDescargaH) * 60 + cheio.min * fator;
      }

      const acc2: Acc = {
        receita: acc.receita + calc.receitaRS,
        custo: acc.custo + calc.custoTotalRS,
        horas: acc.horas + calc.horas,
      };
      if (o.prazoH != null && acc2.horas > o.prazoH) continue;

      usados[i] = true;
      seq.push(i);

      const ret = fim ? leg(c.destino, fim) : null;
      const rc = ret ? custoRetorno(ret, truck) : { diesel: 0, manut: 0, pedagio: 0 };
      const horasTot = acc2.horas + (ret ? (ret.min * fator) / 60 : 0);
      if (o.prazoH == null || horasTot <= o.prazoH) {
        const lucro = acc2.receita - acc2.custo - rc.diesel - rc.manut - rc.pedagio;
        const score = o.objetivo === "HORA" ? lucro / Math.max(horasTot, 0.01) : lucro;
        cands.push({ seq: [...seq], score, lucro });
      }
      if (seq.length < max) dfs(c.destino, t1, acc2);

      seq.pop();
      usados[i] = false;
    }
  }
  dfs(inicio, o.inicioMin, { receita: 0, custo: 0, horas: 0 });

  cands.sort((a, b) => b.score - a.score || b.lucro - a.lucro);
  return cands.slice(0, Math.max(o.top, 1)).map((c) => montar(c.seq, c.score));

  function montar(sequencia: number[], score: number): Plano {
    let prev = inicio;
    let t = o.inicioMin;
    const passos: Passo[] = [];
    const avisos = new Set<string>();
    let alemDaMeiaNoite = false;

    for (const idx of sequencia) {
      const { vazio, cheio, calc } = par(prev, idx);
      const c = cargas[idx];
      let chegadaMin: number | null = null;
      let descargaMin: number | null = null;
      let margemMin: number | null = null;
      let viabilidade: Viabilidade = "DESCONHECIDA";
      if (t != null) {
        chegadaMin = t + vazio.min * fator;
        const lim = parseHora(c.oferta.carregamentoAte);
        if (chegadaMin >= 1440) alemDaMeiaNoite = true;
        else if (lim != null) {
          margemMin = Math.round(lim - chegadaMin);
          viabilidade = margemMin < 0 ? "INVIAVEL" : margemMin < 30 ? "ARRISCADO" : "OK";
        }
        descargaMin = chegadaMin + (truck.tempoCargaH + truck.tempoDescargaH) * 60 + cheio.min * fator;
        t = descargaMin;
      }
      calc.avisos.forEach((a) => avisos.add(a));
      passos.push({ carga: c, de: prev, vazio, cheio, calc, chegadaMin, descargaMin, margemMin, viabilidade });
      prev = c.destino;
    }

    const retorno = fim ? leg(prev, fim) : null;
    const rc = retorno ? custoRetorno(retorno, truck) : { diesel: 0, manut: 0, pedagio: 0 };
    const soma = (f: (p: Passo) => number) => passos.reduce((s, p) => s + f(p), 0);

    const receitaRS = soma((p) => p.calc.receitaRS);
    const dieselRS = soma((p) => p.calc.dieselRS) + rc.diesel;
    const manutencaoRS = soma((p) => p.calc.manutencaoRS) + rc.manut;
    const pedagioRS = soma((p) => p.calc.pedagioRS) + rc.pedagio;
    const custoTotalRS = dieselRS + manutencaoRS + pedagioRS;
    const lucroRS = receitaRS - custoTotalRS;
    const kmVazio = soma((p) => p.vazio.km) + (retorno?.km ?? 0);
    const kmCheio = soma((p) => p.cheio.km);
    const kmTotal = kmVazio + kmCheio;
    const horas = soma((p) => p.calc.horas) + (retorno ? (retorno.min * fator) / 60 : 0);
    const estimado = passos.some((p) => p.vazio.estimado || p.cheio.estimado) || !!retorno?.estimado;

    if (alemDaMeiaNoite) avisos.add("Passa da meia-noite: confira os horários de carregamento das últimas cargas.");
    if (estimado) avisos.add("Distâncias estimadas (sem Google Maps).");

    const ordemViab: Viabilidade[] = ["INVIAVEL", "ARRISCADO", "OK", "DESCONHECIDA"];
    const viabilidade = ordemViab.find((v) => passos.some((p) => p.viabilidade === v)) ?? "DESCONHECIDA";

    return {
      passos,
      inicio,
      fim,
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
      saidaMin: o.inicioMin,
      fimMin: t != null ? t + (retorno ? retorno.min * fator : 0) : null,
      viabilidade,
      estimado,
      avisos: [...avisos],
      score,
      titulo: "",
      motivos: [],
      explicacao: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Texto: por que essa sequência é a melhor (sempre gerado por código, sem gastar IA)
// ---------------------------------------------------------------------------

const km0 = (n: number) => `${Math.round(n)} km`;

type Grau = "NADA" | "POUCO" | "MEDIO" | "MUITO";
function grau(kmVazio: number, kmCheio: number): Grau {
  if (kmVazio < 5) return "NADA";
  if (kmVazio <= 40 || kmVazio <= 0.25 * kmCheio) return "POUCO";
  if (kmVazio <= 100 || kmVazio <= 0.6 * kmCheio) return "MEDIO";
  return "MUITO";
}

export function fmtRelogio(min: number): string {
  const total = Math.round(min);
  const dia = Math.floor(total / 1440);
  const r = total - dia * 1440;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(r / 60))}:${p(r % 60)}${dia > 0 ? ` (+${dia} dia${dia > 1 ? "s" : ""})` : ""}`;
}

function tituloDe(p: Plano): string {
  const nomes: string[] = [p.inicio.apelido];
  for (const s of p.passos) nomes.push(s.carga.origem.apelido, s.carga.destino.apelido);
  if (p.fim) nomes.push(p.fim.apelido);
  return nomes.filter((n, i) => i === 0 || n !== nomes[i - 1]).join(" → ");
}

function explicar(p: Plano, posicao: number, todos: Plano[], objetivo: Objetivo): string[] {
  const frases: string[] = [];
  const ini = p.inicio.apelido;

  p.passos.forEach((s, i) => {
    const o = s.carga.origem.apelido;
    const d = s.carga.destino.apelido;
    const g = grau(s.vazio.km, s.cheio.km);
    const de = s.de.apelido;

    if (i === 0) {
      if (g === "NADA") frases.push(`Você sai de ${ini} e já carrega em ${o}, praticamente sem andar vazio.`);
      else if (g === "POUCO") frases.push(`Você sai de ${ini} andando pouco vazio (${km0(s.vazio.km)}) até carregar em ${o}.`);
      else if (g === "MEDIO") frases.push(`Você sai de ${ini} e anda ${km0(s.vazio.km)} vazio até ${o}.`);
      else frases.push(`Atenção: são ${km0(s.vazio.km)} vazio de ${ini} até ${o}, mas o restante da sequência compensa.`);
    } else {
      if (g === "NADA") {
        frases.push(
          o === de
            ? `Em ${de} já tem outra carga saindo dali mesmo: você não anda vazio.`
            : `Em ${de} já tem carga: ${o} fica colado, sem andar vazio.`,
        );
      }
      else if (g === "POUCO") frases.push(`Em ${de} tem carga perto: ${o} fica a só ${km0(s.vazio.km)} vazio.`);
      else frases.push(`De ${de} até ${o} são ${km0(s.vazio.km)} vazio.`);
    }
    frases.push(`De ${o} até ${d} são ${km0(s.cheio.km)} carregado, e a carga paga ${fmtRS0(s.calc.receitaRS)}.`);
  });

  const ultimo = p.passos[p.passos.length - 1].carga.destino.apelido;
  if (p.fim && p.retorno) {
    const f = p.fim.apelido;
    const r = p.retorno.km;
    if (r < 5) frases.push(`A descarga final é em ${f}: você termina em casa.`);
    else if (r <= 40) frases.push(`A descarga em ${ultimo} fica pertinho de ${f} (${km0(r)}).`);
    else if (r <= 100) frases.push(`Voltar de ${ultimo} para ${f} são ${km0(r)} vazio.`);
    else frases.push(`Voltar de ${ultimo} para ${f} vazio pesa ${km0(r)}, já contado no lucro.`);
  } else {
    frases.push(`A sequência termina em ${ultimo}, sem contar a volta.`);
  }

  frases.push(
    `No total: lucro de ${fmtRS0(p.lucroRS)} em ${fmtHoras(p.horas)} (${fmtRS0(p.lucroPorHoraRS)} por hora), com ${Math.round(p.pctVazio * 100)}% do caminho vazio.`,
  );

  const melhor = todos[0];
  if (posicao === 0 && todos.length > 1) {
    const seg = todos[1];
    if (objetivo === "HORA") frases.push(`Rende ${fmtRS0(p.lucroPorHoraRS - seg.lucroPorHoraRS)} a mais por hora que a 2ª opção.`);
    else frases.push(`Deixa ${fmtRS0(p.lucroRS - seg.lucroRS)} a mais de lucro que a 2ª opção.`);
  } else if (posicao > 0) {
    if (objetivo === "HORA") frases.push(`Fica ${fmtRS0(melhor.lucroPorHoraRS - p.lucroPorHoraRS)} por hora abaixo da 1ª opção.`);
    else frases.push(`Deixa ${fmtRS0(melhor.lucroRS - p.lucroRS)} a menos que a 1ª opção.`);
  }
  return frases;
}

/** Acrescenta título, motivos e explicação. `planos` já deve estar cortado no tamanho final. */
export function anotar(planos: Plano[], objetivo: Objetivo): Plano[] {
  if (planos.length === 0) return planos;
  const comp = planos.length > 1;
  const minVazio = Math.min(...planos.map((p) => p.kmVazio));
  const maxLucro = Math.max(...planos.map((p) => p.lucroRS));
  const minHoras = Math.min(...planos.map((p) => p.horas));

  return planos.map((p, i) => {
    const motivos: string[] = [];
    if (p.passos.length > 1) motivos.push(`${p.passos.length} cargas encadeadas`);
    if (comp && p.kmVazio === minVazio) motivos.push("Menos km vazio");
    if (comp && p.lucroRS === maxLucro) motivos.push("Maior lucro total");
    if (comp && p.horas === minHoras) motivos.push("Mais rápida");
    if (p.retorno && p.retorno.km <= 40) motivos.push("Termina perto de casa");
    if (p.pctVazio <= 0.2) motivos.push(`Só ${Math.round(p.pctVazio * 100)}% vazio`);
    return { ...p, titulo: tituloDe(p), motivos, explicacao: explicar(p, i, planos, objetivo) };
  });
}

/** Versão direta (sem refinar com rotas reais): útil para testes e para o modo sem Google. */
export function planejarTudo(o: OpcoesPlano, leg: LegFn): Plano[] {
  return anotar(planejar(o, leg).slice(0, o.top), o.objetivo);
}

// ---------------------------------------------------------------------------
// Refino: estima tudo de graça, depois pede rota real só do que importa
// ---------------------------------------------------------------------------

export function paresDoPlano(p: Plano): [Local, Local][] {
  const out: [Local, Local][] = [];
  for (const s of p.passos) {
    out.push([s.de, s.carga.origem], [s.carga.origem, s.carga.destino]);
  }
  if (p.fim) out.push([p.passos[p.passos.length - 1].carga.destino, p.fim]);
  return out.filter(([a, b]) => a.id !== b.id);
}

export async function planejarRefinando(
  o: OpcoesPlano,
  buscar: (a: Local, b: Local) => Promise<Leg>,
  opts: { onProgresso?: (feitos: number, total: number) => void; conc?: number } = {},
): Promise<Plano[]> {
  const exato = new Map<string, Leg>();
  const legFn: LegFn = (a, b) => exato.get(chaveLeg(a, b)) ?? estimarLeg(a, b);
  const K = Math.max(o.top + 2, 5);
  let feitos = 0;
  let totalPedidos = 0;
  let planos: Plano[] = [];

  for (let rodada = 0; rodada < 4; rodada++) {
    planos = planejar({ ...o, top: K }, legFn);
    const faltam = new Map<string, [Local, Local]>();
    for (const p of planos) {
      for (const [a, b] of paresDoPlano(p)) {
        const k = chaveLeg(a, b);
        if (!exato.has(k)) faltam.set(k, [a, b]);
      }
    }
    if (faltam.size === 0) break;

    totalPedidos += faltam.size;
    const fila = [...faltam.entries()];
    let i = 0;
    const trabalhador = async () => {
      while (i < fila.length) {
        const [k, [a, b]] = fila[i++];
        try {
          exato.set(k, await buscar(a, b));
        } catch {
          exato.set(k, estimarLeg(a, b)); // não trava: cai na estimativa e avisa no plano
        }
        opts.onProgresso?.(++feitos, totalPedidos);
      }
    };
    await Promise.all(Array.from({ length: Math.min(opts.conc ?? 4, fila.length) }, trabalhador));
  }
  return anotar(planos.slice(0, o.top), o.objetivo);
}

// ---------------------------------------------------------------------------
// Registro no Painel: uma viagem por carga (a volta fica na última)
// ---------------------------------------------------------------------------

export function viagensDoPlano(p: Plano, toneladas: number, truck: Truck) {
  const rc = p.retorno ? custoRetorno(p.retorno, truck) : { diesel: 0, manut: 0, pedagio: 0 };
  const horasRet = p.retorno ? (p.retorno.min * truck.fatorTempo) / 60 : 0;
  return p.passos.map((s, i) => {
    const ultima = i === p.passos.length - 1;
    const dieselRS = s.calc.dieselRS + (ultima ? rc.diesel : 0);
    const manutencaoRS = s.calc.manutencaoRS + (ultima ? rc.manut : 0);
    const pedagioRS = s.calc.pedagioRS + (ultima ? rc.pedagio : 0);
    const custoTotalRS = dieselRS + manutencaoRS + pedagioRS;
    const lucroRS = s.calc.receitaRS - custoTotalRS;
    const horas = s.calc.horas + (ultima ? horasRet : 0);
    return {
      origem: s.carga.origem.apelido,
      destino: s.carga.destino.apelido,
      receitaRS: s.calc.receitaRS,
      dieselRS,
      manutencaoRS,
      pedagioRS,
      custoTotalRS,
      lucroRS,
      lucroPorHoraRS: horas > 0 ? lucroRS / horas : 0,
      horas,
      kmTotal: s.vazio.km + s.cheio.km + (ultima ? p.retorno?.km ?? 0 : 0),
      toneladas,
      ordemNoPlano: i + 1,
    };
  });
}
