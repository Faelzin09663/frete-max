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
  atualizadoEm?: string;
};

export type Unidade = "TONELADA" | "VIAGEM" | "DESCONHECIDA";
export type Pedagio = "REEMBOLSADO" | "POR_CONTA_DO_MOTORISTA" | "NAO_INFORMADO";
export type Agendamento = "PLACA_MARCADA" | "SEM_AGENDAMENTO" | "NAO_INFORMADO";

/** O que a IA extrai de cada oferta de carga. */
export type Oferta = {
  id: string;
  empresa: string | null; // transportadora/empresa que divulgou a oferta
  grupo: string | null; // grupo do WhatsApp de onde veio a mensagem (livre, editável)
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
  // rótulo de qual mensagem colada deu origem a esta oferta (só quando há mais de uma)
  origemMsg?: string;
  // local escolhido à mão na conferência (quando há mais de um lugar com o mesmo nome).
  // Se vazio, o app reconhece o local pelo nome digitado.
  origemLocalId?: string | null;
  destinoLocalId?: string | null;
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

/** Retrato financeiro salvo quando o motorista escolhe/realiza uma carga. */
export type ViagemStatus = "ESCOLHIDA" | "CONCLUIDA";

export type Viagem = {
  id: string;
  realizadaEm: string; // ISO local da data/hora do registro
  status: ViagemStatus;
  origem: string;
  destino: string;
  receitaRS: number;
  dieselRS: number;
  manutencaoRS: number;
  pedagioRS: number;
  custoTotalRS: number;
  lucroRS: number;
  lucroPorHoraRS: number;
  horas: number;
  kmTotal: number;
  toneladas: number;
  // Valores reais preenchidos ao concluir
  receitaRealRS?: number | null;
  dieselRealRS?: number | null;
  pedagioRealRS?: number | null;
  lucroRealRS?: number | null;
  // quando veio de uma sequência planejada (várias cargas em fila)
  planoId?: string;
  ordemNoPlano?: number;
};

export type Ponto = [number, number]; // [lat, lng]

export type MapaDados = {
  segmentos: { tipo: "VAZIO" | "CHEIO"; pontos: Ponto[] }[];
  marcadores: { nome: string; lat: number; lng: number; papel: "POSICAO" | "ORIGEM" | "DESTINO" | "BASE" }[];
  linkGoogle: string;
};

/** Uma carga analisada, salva no histórico (tela "Cargas"). Snapshot do momento da análise. */
export type StatusCarga = "ANALISADA" | "ESCOLHIDA";

export type CargaSalva = {
  id: string; // mesmo id da Oferta que originou esta análise
  empresa: string | null;
  grupo: string | null;
  origemTexto: string;
  destinoTexto: string;
  valor: number | null;
  unidade: Unidade;
  pedagio: Pedagio;
  agendamento: Agendamento;
  carregamentoAte: string | null;
  descargaAte: string | null;
  observacoes: string;
  contato: string | null;
  // snapshot do cálculo no momento salvo
  origemLocalId: string | null;
  destinoLocalId: string | null;
  lucroRS: number | null;
  lucroPorHoraRS: number | null;
  kmVazio: number | null;
  kmCheio: number | null;
  kmRetorno: number | null;
  kmTotal: number | null;
  horas: number | null;
  pctVazio: number | null;
  // metadados
  status: StatusCarga;
  viagemId: string | null;
  analisadaEm: string; // ISO
  mensagemOriginal: string | null; // texto colado que originou esta carga
};
