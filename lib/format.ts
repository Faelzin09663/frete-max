const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const n1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const fmtRS = (n: number) => brl.format(n);
export const fmtRS0 = (n: number) => brl0.format(n);
export const fmtNum = (n: number) => n1.format(n);
export const fmtKm = (n: number) => `${Math.round(n)} km`;

export function fmtHoras(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, "0")}`;
}

export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\./g, (m, i, all) => (all.includes(",") ? "" : m)).replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
