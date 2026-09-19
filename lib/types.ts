export type Truck = {
  nome: string;
  capacidadeT: number;
  eixos: number;
  consumoCheioKmL: number;
  consumoVazioKmL: number;
  dieselRSL: number;
  custoKmRS: number; // manutenção + pneus + depreciação por km
  fatorTempo: number; // multiplica o tempo do Google (feito para carro)
  tempoCargaH: number;
  tempoDescargaH: number;
  baseLocalId: string | null; // para calcular retorno vazio
};

export type Local = {
  id: string;
  apelido: string;
  sinonimos: string[];
  endereco: string;
  lat: number;
  lng: number;
};

export type Unidade = "TONELADA" | "VIAGEM" | "DESCONHECIDA";
export type Pedagio = "REEMBOLSADO" | "POR_CONTA_DO_MOTORISTA" | "NAO_INFORMADO";
export type Agendamento = "PLACA_MARCADA" | "SEM_AGENDAMENTO" | "NAO_INFORMADO";

/** O que a IA extrai de cada oferta de carga. */
export type Oferta = {
  id: string;
  origemTexto: string;
  destinoTexto: string;
  valor: number | null;
  unidade: Unidade;
  pedagio: Pedagio;
  carregamentoAte: string | null; // "HH:MM"
  descargaAte: string | null; // "HH:MM"
  agendamento: Agendamento;
  observacoes: string;
  contato: string | null;
  // ajustes manuais do motorista
  valorManual?: number | null;
  pedagioManualRS?: number | null;
};

export type Leg = {
  km: number;
  min: number;
  tollRS: number;
  estimado: boolean; // true = sem Google, linha reta x fator
  poly?: string; // traçado da rota (polyline codificada do Google)
};

export type Viabilidade = "OK" | "ARRISCADO" | "INVIAVEL" | "DESCONHECIDA";

export type CalcResult = {
  receitaRS: number;
  dieselRS: number;
  manutencaoRS: number;
  pedagioRS: number;
  custoTotalRS: number;
  lucroRS: number;
  kmVazio: number;
  kmCheio: number;
  kmRetorno: number;
  kmTotal: number;
  pctVazio: number; // 0..1
  horas: number;
  lucroPorHoraRS: number;
  lucroPorKmRS: number;
  viabilidade: Viabilidade;
  margemMin: number | null; // minutos de folga até o limite de carregamento
  estimado: boolean;
  avisos: string[];
};

export type Ponto = [number, number]; // [lat, lng]

export type MapaDados = {
  segmentos: { tipo: "VAZIO" | "CHEIO"; pontos: Ponto[] }[];
  marcadores: { nome: string; lat: number; lng: number; papel: "POSICAO" | "ORIGEM" | "DESTINO" | "BASE" }[];
  linkGoogle: string;
};
