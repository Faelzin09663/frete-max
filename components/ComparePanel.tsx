"use client";
import { Icon } from "@/components/Icons";
import { fmtHoras, fmtKm, fmtRS0 } from "@/lib/format.ts";
import type { CalcResult, Oferta } from "@/lib/types.ts";

type CompareLine = {
  oferta: Oferta;
  origemNome: string;
  destinoNome: string;
  calc: CalcResult;
};

export function ComparePanel({ linhas }: { linhas: CompareLine[] }) {
  if (linhas.length < 2) return null;

  const viaveis = linhas.filter((l) => l.calc.viabilidade !== "INVIAVEL");
  if (viaveis.length < 2) return null;

  // Find best by hour and best by total profit
  const sortedByHour = [...viaveis].sort((a, b) => b.calc.lucroPorHoraRS - a.calc.lucroPorHoraRS);
  const best = sortedByHour[0];
  const bestByProfit = [...viaveis].sort((a, b) => b.calc.lucroRS - a.calc.lucroRS)[0];

  // Only show if best-by-hour differs from best-by-profit (interesting comparison)
  const showRecommendation = best.oferta.id !== bestByProfit.oferta.id;

  return (
    <section className="compare-panel" aria-label="Comparação de cargas">
      <div className="compare-header">
        <Icon name="compare" size={22} />
        <h2>Comparação rápida</h2>
      </div>

      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>Rota</th>
              <th>Lucro</th>
              <th>Tempo</th>
              <th>Diesel</th>
              <th>Pedágio</th>
              <th>R$/hora</th>
            </tr>
          </thead>
          <tbody>
            {sortedByHour.map((l, i) => (
              <tr key={l.oferta.id} className={i === 0 ? "compare-best" : ""}>
                <td className="compare-route">
                  <span>{l.origemNome}</span>
                  <Icon name="arrow" size={14} />
                  <span>{l.destinoNome}</span>
                </td>
                <td className={l.calc.lucroRS >= 0 ? "gain-text" : "loss-text"}>
                  {fmtRS0(l.calc.lucroRS)}
                </td>
                <td>{fmtHoras(l.calc.horas)}</td>
                <td>{fmtRS0(l.calc.dieselRS)}</td>
                <td>{fmtRS0(l.calc.pedagioRS)}</td>
                <td>
                  <strong className={l.calc.lucroPorHoraRS >= 0 ? "gain-text" : "loss-text"}>
                    {fmtRS0(l.calc.lucroPorHoraRS)}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showRecommendation && (
        <div className="compare-rec">
          <Icon name="trophy" size={20} />
          <div>
            <strong>Recomendação:</strong>{" "}
            <strong className="gain-text">{best.origemNome} → {best.destinoNome}</strong> rende{" "}
            <strong>{fmtRS0(best.calc.lucroPorHoraRS)}/h</strong> — é melhor que{" "}
            {bestByProfit.origemNome} → {bestByProfit.destinoNome} (
            {fmtRS0(bestByProfit.calc.lucroPorHoraRS)}/h) mesmo lucrando{" "}
            {fmtRS0(best.calc.lucroRS)} vs {fmtRS0(bestByProfit.calc.lucroRS)}.{" "}
            Gasta menos diesel ({fmtRS0(best.calc.dieselRS)} vs{" "}
            {fmtRS0(bestByProfit.calc.dieselRS)}), menos pedágio e faz em{" "}
            {fmtHoras(best.calc.horas)} vs {fmtHoras(bestByProfit.calc.horas)}.
          </div>
        </div>
      )}
    </section>
  );
}
