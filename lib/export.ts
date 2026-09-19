import type { Viagem, Truck, Local } from "./types.ts";
import { fmtRS } from "./format.ts";

// ---------- CSV Export ----------

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportarViagensCSV(viagens: Viagem[], nomeArquivo: string = "fretemax-viagens.csv") {
  const headers = [
    "Data", "Status", "Origem", "Destino", "Toneladas",
    "Receita (R$)", "Diesel (R$)", "Manutenção (R$)", "Pedágio (R$)",
    "Custo Total (R$)", "Lucro (R$)", "Lucro/Hora (R$)", "Horas", "Km Total",
    "Receita Real (R$)", "Diesel Real (R$)", "Pedágio Real (R$)", "Lucro Real (R$)",
  ];

  const rows = viagens.map((v) => [
    new Date(v.realizadaEm).toLocaleDateString("pt-BR"),
    v.status === "CONCLUIDA" ? "Concluída" : "Escolhida",
    v.origem,
    v.destino,
    String(v.toneladas),
    v.receitaRS.toFixed(2),
    v.dieselRS.toFixed(2),
    v.manutencaoRS.toFixed(2),
    v.pedagioRS.toFixed(2),
    v.custoTotalRS.toFixed(2),
    v.lucroRS.toFixed(2),
    v.lucroPorHoraRS.toFixed(2),
    v.horas.toFixed(1),
    Math.round(v.kmTotal).toString(),
    v.receitaRealRS != null ? v.receitaRealRS.toFixed(2) : "",
    v.dieselRealRS != null ? v.dieselRealRS.toFixed(2) : "",
    v.pedagioRealRS != null ? v.pedagioRealRS.toFixed(2) : "",
    v.lucroRealRS != null ? v.lucroRealRS.toFixed(2) : "",
  ]);

  const csv = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  baixarArquivo(csv, nomeArquivo, "text/csv;charset=utf-8");
}

export function exportarSemanaCSV(viagens: Viagem[]) {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  const fim = new Date(inicio.getTime() + 7 * 86400000);

  const semana = viagens.filter((v) => {
    const d = new Date(v.realizadaEm);
    return d >= inicio && d < fim;
  });

  const receita = semana.reduce((s, v) => s + v.receitaRS, 0);
  const diesel = semana.reduce((s, v) => s + v.dieselRS, 0);
  const manut = semana.reduce((s, v) => s + v.manutencaoRS, 0);
  const pedagio = semana.reduce((s, v) => s + v.pedagioRS, 0);
  const lucro = semana.reduce((s, v) => s + v.lucroRS, 0);
  const km = semana.reduce((s, v) => s + v.kmTotal, 0);

  const nome = `fretemax-semana-${inicio.toISOString().slice(0, 10)}.csv`;

  // Build CSV with summary at top
  const summary = [
    `Fechamento semanal FreteMax`,
    `Período: ${inicio.toLocaleDateString("pt-BR")} a ${new Date(fim.getTime() - 86400000).toLocaleDateString("pt-BR")}`,
    `Viagens: ${semana.length}`,
    `Receita total: ${fmtRS(receita)}`,
    `Diesel total: ${fmtRS(diesel)}`,
    `Manutenção total: ${fmtRS(manut)}`,
    `Pedágio total: ${fmtRS(pedagio)}`,
    `Lucro total: ${fmtRS(lucro)}`,
    `Km total: ${Math.round(km)}`,
    ``,
  ];

  exportarViagensCSV(semana, nome);
  // Note: the summary is informational; the CSV has all detail rows
}

// ---------- JSON Backup ----------

type Backup = {
  versao: string;
  exportadoEm: string;
  truck: Truck;
  locais: Local[];
  viagens: Viagem[];
};

export function exportarJSON(truck: Truck, locais: Local[], viagens: Viagem[]) {
  const backup: Backup = {
    versao: "0.8",
    exportadoEm: new Date().toISOString(),
    truck,
    locais,
    viagens,
  };
  const json = JSON.stringify(backup, null, 2);
  baixarArquivo(json, `fretemax-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
}

export async function importarJSON(
  file: File,
): Promise<{ truck: Truck; locais: Local[]; viagens: Viagem[] }> {
  const text = await file.text();
  const data = JSON.parse(text) as Backup;

  if (!data.truck || !Array.isArray(data.locais) || !Array.isArray(data.viagens)) {
    throw new Error("Arquivo de backup inválido.");
  }

  // Ensure all viagens have a status field (backward compat)
  const viagens = data.viagens.map((v) => ({
    ...v,
    status: v.status ?? "CONCLUIDA",
  }));

  return { truck: data.truck, locais: data.locais, viagens };
}

// ---------- Helpers ----------

function baixarArquivo(conteudo: string, nome: string, tipo: string) {
  const blob = new Blob(["\uFEFF" + conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
