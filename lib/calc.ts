import type { CalcResult, Leg, Oferta, Truck, Viabilidade } from "./types.ts";

export function parseHora(h: string | null | undefined): number | null {
  if (!h) return null;
  const m = /^(\d{1,2})(?::|h)?(\d{2})?$/.exec(h.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

export type CalcInput = {
  oferta: Oferta;
  truck: Truck;
  toneladas: number;
  vazio: Leg; // posição atual -> origem
  cheio: Leg; // origem -> destino
  retorno: Leg | null; // destino -> base (opcional)
  agoraMin: number | null; // hora atual em minutos desde 00:00
};

export function valorEfetivo(o: Oferta): number | null {
  return o.valorManual ?? o.valor;
}

export function calcular(i: CalcInput): CalcResult {
  const { oferta, truck, toneladas, vazio, cheio, retorno } = i;
  const avisos: string[] = [];
  const valor = valorEfetivo(oferta);

  let unidade = oferta.unidade;
  if (valor != null && unidade === "DESCONHECIDA") {
    unidade = "TONELADA";
    avisos.push("Unidade do valor não informada: considerei valor por tonelada.");
  }
  const receitaRS = valor == null ? 0 : unidade === "VIAGEM" ? valor : valor * toneladas;
  if (valor == null) avisos.push("Sem valor na mensagem. Preencha o frete para calcular.");

  const kmVazio = vazio.km;
  const kmCheio = cheio.km;
  const kmRetorno = retorno?.km ?? 0;
  const kmTotal = kmVazio + kmCheio + kmRetorno;

  const dieselRS =
    (kmCheio / truck.consumoCheioKmL + (kmVazio + kmRetorno) / truck.consumoVazioKmL) *
    truck.dieselRSL;
  const manutencaoRS = kmTotal * truck.custoKmRS;

  // Pedágio: o trecho vazio e o retorno são sempre do motorista.
  // O trecho cheio só é dele se o pedágio não for reembolsado.
  const tollCheio = oferta.pedagioManualRS ?? cheio.tollRS;
  let pedagioRS = vazio.tollRS + (retorno?.tollRS ?? 0);
  if (oferta.pedagio !== "REEMBOLSADO") pedagioRS += tollCheio;
  if (oferta.pedagio === "NAO_INFORMADO") {
    avisos.push("Pedágio não informado: considerei por sua conta.");
  }

  const custoTotalRS = dieselRS + manutencaoRS + pedagioRS;
  const lucroRS = receitaRS - custoTotalRS;

  const fator = truck.fatorTempo;
  const minDirigindo = (vazio.min + cheio.min + (retorno?.min ?? 0)) * fator;
  const horas = minDirigindo / 60 + truck.tempoCargaH + truck.tempoDescargaH;

  // Viabilidade do horário de carregamento
  const limite = parseHora(oferta.carregamentoAte);
  let viabilidade: Viabilidade = "DESCONHECIDA";
  let margemMin: number | null = null;
  if (limite != null && i.agoraMin != null) {
    const chegada = i.agoraMin + vazio.min * fator;
    margemMin = Math.round(limite - chegada);
    viabilidade = margemMin < 0 ? "INVIAVEL" : margemMin < 30 ? "ARRISCADO" : "OK";
  }

  const estimado = vazio.estimado || cheio.estimado || !!retorno?.estimado;
  if (estimado) avisos.push("Distâncias estimadas (sem Google Maps).");

  // ---------- alertas de bom senso ----------
  if (truck.consumoCheioKmL <= 0 || truck.consumoVazioKmL <= 0) {
    avisos.push("⚠️ Consumo zerado no caminhão. Confira em Caminhão > Consumo.");
  }
  if (toneladas > truck.capacidadeT * 1.05) {
    avisos.push(`⚠️ Carga de ${toneladas}t acima da capacidade do caminhão (${truck.capacidadeT}t).`);
  }
  if (valor != null && unidade === "TONELADA" && kmCheio > 200 && valor < 50) {
    avisos.push("⚠️ Frete muito baixo para essa distância. Confira o valor.");
  }
  if (valor != null && unidade === "TONELADA" && valor > 500) {
    avisos.push("⚠️ Frete acima de R$500/t — verifique se o valor está certo.");
  }
  if (kmTotal > 3000) {
    avisos.push("⚠️ Mais de 3.000 km no total. Confira os locais de origem e destino.");
  }
  if (horas > 48) {
    avisos.push("⚠️ Viagem de mais de 48h. Verifique se a rota está correta.");
  }
  if (valor != null && lucroRS < -500) {
    avisos.push("⚠️ Prejuízo forte (mais de R$500). Vale conferir os números.");
  }

  return {
    receitaRS,
    dieselRS,
    manutencaoRS,
    pedagioRS,
    custoTotalRS,
    lucroRS,
    kmVazio,
    kmCheio,
    kmRetorno,
    kmTotal,
    pctVazio: kmTotal > 0 ? (kmVazio + kmRetorno) / kmTotal : 0,
    horas,
    lucroPorHoraRS: horas > 0 ? lucroRS / horas : 0,
    lucroPorKmRS: kmTotal > 0 ? lucroRS / kmTotal : 0,
    viabilidade,
    margemMin,
    estimado,
    avisos,
  };
}
