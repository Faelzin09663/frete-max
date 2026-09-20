import { calcular } from "../lib/calc.ts";
import { estimarLeg } from "../lib/geo.ts";
import { fmtRelogio, paresDoPlano, planejar, planejarRefinando, planejarTudo, viagensDoPlano } from "../lib/plano.ts";
import type { Carga, OpcoesPlano } from "../lib/plano.ts";
import type { Leg, Local, Oferta, Truck } from "../lib/types.ts";

const truck: Truck = {
  nome: "t", capacidadeT: 30, eixos: 6, consumoCheioKmL: 2, consumoVazioKmL: 3,
  dieselRSL: 6, custoKmRS: 1, fatorTempo: 1, tempoCargaH: 1, tempoDescargaH: 1, baseLocalId: null,
};
const L = (id: string, apelido: string, lat: number, lng: number): Local => ({ id, apelido, sinonimos: [], endereco: "", lat, lng });
const casa = L("casa", "Casa", -19.92, -43.94); // Belo Horizonte
const sl = L("sl", "Sete Lagoas", -19.46, -44.25);
const cg = L("cg", "Congonhas", -20.5, -43.86);
const ip = L("ip", "Ipatinga", -19.47, -42.54);
const bru = L("bru", "Brumadinho", -20.14, -44.2);
const oP = L("op", "Ouro Preto", -20.39, -43.5);
const mont = L("mont", "Montes Claros", -16.73, -43.86);

let n = 0;
const oferta = (valor: number, extra: Partial<Oferta> = {}): Oferta => ({
  id: `o${++n}`, origemTexto: "", destinoTexto: "", valor, unidade: "TONELADA", pedagio: "REEMBOLSADO",
  carregamentoAte: null, descargaAte: null, agendamento: "NAO_INFORMADO", observacoes: "", contato: null, ...extra,
});
const carga = (o: Local, d: Local, valor: number, extra: Partial<Oferta> = {}): Carga => ({ oferta: oferta(valor, extra), origem: o, destino: d });

let falhas = 0;
function ok(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++;
  console.log(cond ? "ok  " : "FAIL", nome, cond ? "" : detalhe);
}
const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

const leg = (a: Local, b: Local) => estimarLeg(a, b);
const base: Omit<OpcoesPlano, "cargas"> = {
  inicio: casa, fim: casa, truck, toneladas: 30, inicioMin: 6 * 60, maxCargas: 3, objetivo: "LUCRO", prazoH: null, top: 3,
};

// ---------- cenário do motorista ----------
// Casa -> (SL->CG) -> (CG->IP) -> Casa   contra cargas soltas
const encadeadas = [carga(sl, cg, 80), carga(cg, ip, 100)];
const soltas = [
  carga(bru, oP, 60),
  carga(mont, casa, 70), // longe
  carga(sl, casa, 50),
];
const todas = [...soltas, ...encadeadas];
const r = planejarTudo({ ...base, cargas: todas }, leg);
console.log("\n#1:", r[0].titulo, "| lucro", Math.round(r[0].lucroRS), "| horas", r[0].horas.toFixed(1));
console.log(r[0].explicacao.join("\n"), "\n");
ok("melhor sequência encadeia 2+ cargas", r[0].passos.length >= 2, r[0].titulo);
ok("a sequência começa por Sete Lagoas", r[0].passos[0].carga.origem.id === "sl", r[0].titulo);
ok("ranking em ordem decrescente", r.every((p, i) => i === 0 || r[i - 1].score >= p.score));
ok("explicação cita os nomes", r[0].explicacao.join(" ").includes("Sete Lagoas") && r[0].explicacao.join(" ").includes("Congonhas"));
ok("tem motivos", r[0].motivos.length > 0);

// ---------- consistência: plano de 1 carga == calcular() com retorno ----------
const unica = carga(sl, cg, 80);
const p1 = planejar({ ...base, cargas: [unica], maxCargas: 1 }, leg)[0];
const c1 = calcular({
  oferta: unica.oferta, truck, toneladas: 30, vazio: leg(casa, sl), cheio: leg(sl, cg), retorno: leg(cg, casa), agoraMin: null,
});
ok("lucro do plano = lucro do calcular()", perto(p1.lucroRS, c1.lucroRS), `${p1.lucroRS} vs ${c1.lucroRS}`);
ok("horas do plano = horas do calcular()", perto(p1.horas, c1.horas));
ok("km total do plano = calcular()", perto(p1.kmTotal, c1.kmTotal));
ok("score LUCRO = lucro", perto(p1.score, p1.lucroRS));
const p1h = planejar({ ...base, cargas: [unica], maxCargas: 1, objetivo: "HORA" }, leg)[0];
ok("score HORA = lucro/hora", perto(p1h.score, p1h.lucroPorHoraRS));

// ---------- sequência de 2 cargas soma corretamente ----------
const dupla = planejar({ ...base, cargas: encadeadas, maxCargas: 2, top: 10 }, leg).find((p) => p.passos.length === 2 && p.passos[0].carga.origem.id === "sl")!;
const a = calcular({ oferta: encadeadas[0].oferta, truck, toneladas: 30, vazio: leg(casa, sl), cheio: leg(sl, cg), retorno: null, agoraMin: null });
const b = calcular({ oferta: encadeadas[1].oferta, truck, toneladas: 30, vazio: leg(cg, cg), cheio: leg(cg, ip), retorno: leg(ip, casa), agoraMin: null });
ok("plano de 2 cargas = soma dos cálculos", perto(dupla.lucroRS, a.lucroRS + b.lucroRS), `${dupla.lucroRS} vs ${a.lucroRS + b.lucroRS}`);
ok("carrega em Congonhas sem andar vazio", dupla.passos[1].vazio.km === 0);

// ---------- maxCargas ----------
const so1 = planejar({ ...base, cargas: todas, maxCargas: 1, top: 50 }, leg);
ok("maxCargas=1 só devolve planos de 1 carga", so1.every((p) => p.passos.length === 1) && so1.length === todas.length);
const ate3 = planejar({ ...base, cargas: todas, maxCargas: 3, top: 10000 }, leg);
ok("nenhuma carga repetida numa sequência", ate3.every((p) => new Set(p.passos.map((s) => s.carga.oferta.id)).size === p.passos.length));
// 5 cargas: 5 + 20 + 60 = 85 sequências de até 3
ok("conta de sequências (5P1+5P2+5P3 = 85)", ate3.length === 85, String(ate3.length));

// ---------- sem volta para casa ----------
const semVolta = planejar({ ...base, fim: null, cargas: [unica], maxCargas: 1 }, leg)[0];
ok("sem fim: sem retorno e sem km da volta", semVolta.retorno === null && perto(semVolta.kmTotal, leg(casa, sl).km + leg(sl, cg).km));
ok("sem fim: lucro maior que com volta", semVolta.lucroRS > p1.lucroRS);

// ---------- janela de horário ----------
// sair 10:00, Casa->Sete Lagoas ~ 95 min de estrada estimada (km = min): chega 11:35+
const apertada = carga(sl, cg, 80, { carregamentoAte: "10:30" });
const inv = planejar({ ...base, cargas: [apertada], maxCargas: 1, inicioMin: 10 * 60 }, leg);
ok("carga que não chega a tempo é descartada", inv.length === 0);
const folga = planejar({ ...base, cargas: [carga(sl, cg, 80, { carregamentoAte: "23:00" })], maxCargas: 1, inicioMin: 10 * 60 }, leg);
ok("carga com folga entra e marca viabilidade OK", folga.length === 1 && folga[0].viabilidade === "OK" && (folga[0].passos[0].margemMin ?? 0) > 0);
// segunda carga com janela que só dá pra cumprir se a primeira for rápida
const enc2 = [carga(sl, cg, 80), carga(cg, ip, 100, { carregamentoAte: "09:00" })];
const cedo = planejar({ ...base, cargas: enc2, maxCargas: 2, inicioMin: 6 * 60, top: 10 }, leg);
ok("janela da 2ª carga barra Sete Lagoas → Congonhas → Ipatinga (não dá tempo)", !cedo.some((p) => p.passos.length === 2 && p.passos[0].carga.origem.id === "sl"));
ok("mas a ordem inversa (Congonhas primeiro) continua possível", cedo.some((p) => p.passos[0].carga.origem.id === "cg"));
const semRelogio = planejar({ ...base, cargas: enc2, maxCargas: 2, inicioMin: null, top: 10 }, leg);
ok("sem horário de saída, janelas são ignoradas", semRelogio.some((p) => p.passos.length === 2));

// ---------- prazo ----------
const curto = planejar({ ...base, cargas: encadeadas, maxCargas: 2, prazoH: 6, top: 10 }, leg);
ok("prazo curto barra sequências longas", curto.every((p) => p.horas <= 6 + 1e-9));

// ---------- sem preço fica de fora (a tela filtra); valor 0 não quebra ----------
ok("não quebra com lista vazia", planejar({ ...base, cargas: [] }, leg).length === 0);

// ---------- registro no painel ----------
const v = viagensDoPlano(dupla, 30, truck);
ok("uma viagem por carga", v.length === 2 && v[0].ordemNoPlano === 1 && v[1].ordemNoPlano === 2);
ok("soma das viagens = lucro do plano", perto(v.reduce((s, x) => s + x.lucroRS, 0), dupla.lucroRS, 0.001));
ok("a volta fica na última viagem", v[1].kmTotal > dupla.passos[1].vazio.km + dupla.passos[1].cheio.km);

// ---------- pares de rota para pedir ao Google ----------
const pares = paresDoPlano(dupla);
ok("pares do plano: casa→SL, SL→CG, CG→IP, IP→casa (CG→CG some)", pares.length === 4, String(pares.length));

// ---------- relógio ----------
ok("relógio", fmtRelogio(8 * 60 + 5) === "08:05" && fmtRelogio(25 * 60) === "01:00 (+1 dia)");

// ---------- refino: só pede rota real do que importa ----------
const dez: Carga[] = [
  carga(sl, cg, 80), carga(cg, ip, 100), carga(bru, oP, 60), carga(mont, casa, 70), carga(sl, casa, 50),
  carga(oP, bru, 55), carga(ip, casa, 65), carga(casa, sl, 45), carga(cg, casa, 40), carga(ip, sl, 60),
];
const pedidos: string[] = [];
const buscar = async (x: Local, y: Local): Promise<Leg> => {
  pedidos.push(`${x.id}>${y.id}`);
  const e = estimarLeg(x, y);
  return { ...e, estimado: false, km: e.km * 1.1, min: e.min * 1.1 }; // "Google" 10% pior que a estimativa
};
const t0 = performance.now();
const refinado = await planejarRefinando({ ...base, cargas: dez, maxCargas: 4, objetivo: "HORA", top: 3 }, buscar);
const ms = performance.now() - t0;
const maximoTeorico = 10 + 10 * 9 + 10 + 10; // início→origem, origem→destino, destino→origem, destino→fim
console.log(`\n10 propostas, até 4 cargas: ${ms.toFixed(0)} ms, ${pedidos.length} rotas reais pedidas (máx. teórico ${maximoTeorico})`);
console.log("#1 refinado:", refinado[0].titulo);
ok("refino pede muito menos rotas que o total possível", pedidos.length < maximoTeorico / 3, String(pedidos.length));
ok("não pede a mesma rota duas vezes", new Set(pedidos).size === pedidos.length);
ok("planos refinados usam rota real", refinado.every((p) => !p.estimado));
ok("busca de 10 propostas é rápida (< 2 s)", ms < 2000, `${ms}ms`);

// falha do Google não trava
const comFalha = await planejarRefinando({ ...base, cargas: dez.slice(0, 3), maxCargas: 2, top: 2 }, async () => { throw new Error("cota"); });
ok("se a rota falhar, usa estimativa e sinaliza", comFalha.length > 0 && comFalha[0].estimado && comFalha[0].avisos.some((x) => x.includes("estimadas")));

console.log(falhas === 0 ? "\nTodos os testes do planejador passaram." : `\n${falhas} falha(s).`);
process.exit(falhas ? 1 : 0);
