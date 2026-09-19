import { calcular, parseHora } from "../lib/calc.ts";
import { acharLocal } from "../lib/match.ts";
import { decodePolyline } from "../lib/polyline.ts";
import { montarMapa } from "../lib/mapa.ts";
import type { Oferta, Truck, Local } from "../lib/types.ts";

const truck: Truck = {
  nome: "t", capacidadeT: 30, eixos: 6, consumoCheioKmL: 2, consumoVazioKmL: 3,
  dieselRSL: 6, custoKmRS: 1, fatorTempo: 1, tempoCargaH: 1, tempoDescargaH: 0.5,
  baseLocalId: null,
};
const base: Oferta = {
  id: "1", origemTexto: "", destinoTexto: "", valor: 45, unidade: "TONELADA",
  pedagio: "REEMBOLSADO", carregamentoAte: "11:30", descargaAte: null,
  agendamento: "PLACA_MARCADA", observacoes: "", contato: null,
};
const leg = (km: number, min: number, tollRS = 0) => ({ km, min, tollRS, estimado: false });

let falhas = 0;
function eq(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(ok ? "ok  " : "FAIL", nome, ok ? "" : `got=${got} want=${want}`);
}
const arred = (n: number) => Math.round(n * 100) / 100;
const semData = { retorno: null, agoraMin: null };

// Carga Y: 120 km vazio + 60 cheio, 45/t x 30t = 1350
const y = calcular({ oferta: base, truck, toneladas: 30, vazio: leg(120, 120), cheio: leg(60, 60), retorno: null, agoraMin: 8 * 60 });
eq("Y receita", y.receitaRS, 1350);
eq("Y diesel (60/2*6 + 120/3*6)", arred(y.dieselRS), 420);
eq("Y lucro (1350 - 420 - 180)", arred(y.lucroRS), 750);
eq("Y horas", y.horas, 4.5);

// Carga Z: 10 km vazio + 60 cheio, 40/t
const z = calcular({ oferta: { ...base, valor: 40 }, truck, toneladas: 30, vazio: leg(10, 10), cheio: leg(60, 60), retorno: null, agoraMin: 8 * 60 });
eq("Z lucro", arred(z.lucroRS), 930);
eq("Z paga menos mas lucra mais", z.lucroRS > y.lucroRS, true);
eq("Z lucro/h maior", z.lucroPorHoraRS > y.lucroPorHoraRS, true);

eq("valor por viagem", calcular({ oferta: { ...base, valor: 1000, unidade: "VIAGEM" }, truck, toneladas: 30, vazio: leg(0, 0), cheio: leg(10, 10), ...semData }).receitaRS, 1000);

const tolls = (p: Oferta["pedagio"]) => calcular({ oferta: { ...base, pedagio: p }, truck, toneladas: 30, vazio: leg(0, 0, 5), cheio: leg(10, 10, 20), ...semData }).pedagioRS;
eq("pedágio reembolsado (só vazio)", tolls("REEMBOLSADO"), 5);
eq("pedágio por conta do motorista", tolls("POR_CONTA_DO_MOTORISTA"), 25);

eq("sem valor -> receita 0", calcular({ oferta: { ...base, valor: null }, truck, toneladas: 30, vazio: leg(0, 0), cheio: leg(10, 10), ...semData }).receitaRS, 0);
eq("valor manual", calcular({ oferta: { ...base, valor: null, valorManual: 50 }, truck, toneladas: 30, vazio: leg(0, 0), cheio: leg(10, 10), ...semData }).receitaRS, 1500);

// Limite 11:30. Agora 10:00.
const v = (min: number) => calcular({ oferta: base, truck, toneladas: 30, vazio: leg(50, min), cheio: leg(10, 10), retorno: null, agoraMin: 600 }).viabilidade;
eq("viabilidade OK (folga 30min)", v(60), "OK");
eq("viabilidade arriscada (folga 10min)", v(80), "ARRISCADO");
eq("viabilidade inviável", v(120), "INVIAVEL");

eq("parseHora 11:30", parseHora("11:30"), 690);
eq("parseHora 18h", parseHora("18h"), 1080);
eq("parseHora inválido", parseHora("amanhã"), null);

const locais: Local[] = [
  { id: "a", apelido: "Rocha", sinonimos: ["Tejucana - Rocha"], endereco: "", lat: 0, lng: 0 },
  { id: "b", apelido: "Sete Lagoas", sinonimos: [], endereco: "", lat: 0, lng: 0 },
];
eq("match exato", acharLocal("SETE LAGOAS", locais)?.id, "b");
eq("match sinônimo", acharLocal("Tejucana - Rocha", locais)?.id, "a");
eq("match contido", acharLocal("Tejucana - Rocha (Brumadinho)", locais)?.id, "a");
eq("sem match", acharLocal("Extrativa", locais), null);

// Polyline (exemplo oficial da documentação do Google)
const dec = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
eq("polyline: 3 pontos", dec.length, 3);
eq("polyline: ponto 1", dec[0], [38.5, -120.2]);
eq("polyline: ponto 3", dec[2], [43.252, -126.453]);

const L = (id: string, lat: number, lng: number): Local => ({ id, apelido: id, sinonimos: [], endereco: "", lat, lng });
const m = montarMapa(L("p", -19.9, -43.9), L("o", -19.5, -44.0), L("d", -19.4, -44.2), null, leg(10, 10), leg(20, 20), null);
eq("mapa: 2 segmentos (vazio+cheio)", m.segmentos.map((s) => s.tipo), ["VAZIO", "CHEIO"]);
eq("mapa: 3 marcadores", m.marcadores.length, 3);
eq("mapa: link com waypoint", m.linkGoogle.includes("waypoints=-19.5%2C-44"), true);
const m2 = montarMapa(null, L("o", -19.5, -44.0), L("d", -19.4, -44.2), null, leg(0, 0), leg(20, 20), null);
eq("mapa sem posição: só cheio", m2.segmentos.map((s) => s.tipo), ["CHEIO"]);

console.log(falhas === 0 ? "\nTodos os testes passaram." : `\n${falhas} falha(s).`);
process.exit(falhas ? 1 : 0);
