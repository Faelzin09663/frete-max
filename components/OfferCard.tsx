"use client";
import { useState } from "react";
import { NumInput } from "@/components/NumInput";
import { RouteMap } from "@/components/RouteMap";
import { fmtHoras, fmtKm, fmtRS, fmtRS0 } from "@/lib/format.ts";
import type { CalcResult, MapaDados, Oferta } from "@/lib/types.ts";

export type Selo = "LUCRO" | "HORA";

const VIAB = {
  OK: { txt: "Dá tempo de chegar", cls: "gain" },
  ARRISCADO: { txt: "Horário apertado", cls: "warn" },
  INVIAVEL: { txt: "Não chega a tempo", cls: "loss" },
} as const;

export function OfferCard({
  oferta,
  origemNome,
  destinoNome,
  calc,
  mapa,
  selos,
  onEditar,
}: {
  oferta: Oferta;
  origemNome: string;
  destinoNome: string;
  calc: CalcResult;
  mapa: MapaDados | null;
  selos: Selo[];
  onEditar: (patch: Partial<Oferta>) => void;
}) {
  const [mapaAberto, setMapaAberto] = useState(false);
  const semValor = oferta.valor == null && oferta.valorManual == null;
  const positivo = calc.lucroRS >= 0;
  const viab = calc.viabilidade !== "DESCONHECIDA" ? VIAB[calc.viabilidade] : null;
  const kmPct = Math.max(0, Math.min(100, calc.pctVazio * 100));

  return (
    <article className={`load ${selos.length ? "best" : ""} ${calc.viabilidade === "INVIAVEL" ? "dim" : ""}`}>
      <div className="route">
        {origemNome}
        <span className="sep">→</span>
        {destinoNome}
      </div>

      <div className="chips">
        {selos.includes("LUCRO") && <span className="chip gain">Maior lucro</span>}
        {selos.includes("HORA") && <span className="chip gain">Melhor por hora</span>}
        {viab && (
          <span className={`chip ${viab.cls}`}>
            {viab.txt}
            {calc.margemMin != null && calc.viabilidade !== "INVIAVEL" ? ` (folga ${fmtHoras(calc.margemMin / 60)})` : ""}
          </span>
        )}
        {oferta.agendamento === "PLACA_MARCADA" && <span className="chip warn">Placa marcada: ligue antes</span>}
        {oferta.agendamento === "SEM_AGENDAMENTO" && <span className="chip">Sem agendamento</span>}
        {oferta.carregamentoAte && <span className="chip">Carregar até {oferta.carregamentoAte}</span>}
      </div>

      {oferta.valor == null && (
        <div className="inline-fix">
          <NumInput
            value={oferta.valorManual ?? null}
            placeholder="Frete R$/t"
            aoSair
            onChange={(n) => onEditar({ valorManual: n })}
          />
          <span className="hint">Sem preço na mensagem. Digite o frete por tonelada.</span>
        </div>
      )}
      {!semValor && (
        <div className="money">
          <div>
            <span className={`big ${positivo ? "gain" : "loss"}`}>{fmtRS0(calc.lucroRS)}</span>
            <span className="cap">lucro na viagem</span>
          </div>
          <div>
            <span className="mid">{fmtRS0(calc.lucroPorHoraRS)}</span>
            <span className="cap">por hora ({fmtHoras(calc.horas)} no total)</span>
          </div>
        </div>
      )}

      <div className="kmbar" role="img" aria-label={`${fmtKm(calc.kmVazio + calc.kmRetorno)} vazio e ${fmtKm(calc.kmCheio)} cheio`}>
        <div className="empty-km" style={{ width: `${kmPct}%` }} />
        <div className="full-km" style={{ width: `${100 - kmPct}%` }} />
      </div>
      <div className="kmlab">
        <span>Vazio {fmtKm(calc.kmVazio + calc.kmRetorno)}</span>
        <span>Cheio {fmtKm(calc.kmCheio)}</span>
      </div>

      {calc.avisos.map((a) => (
        <div className="note" key={a}>
          {a}
        </div>
      ))}

      {mapa && (
        <details onToggle={(e) => setMapaAberto((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>Ver no mapa</summary>
          {mapaAberto && <RouteMap dados={mapa} />}
        </details>
      )}

      <details>
        <summary>Ver a conta</summary>
        <table className="break">
          <tbody>
            <tr>
              <td>Frete</td>
              <td>{fmtRS(calc.receitaRS)}</td>
            </tr>
            <tr>
              <td>Diesel</td>
              <td>− {fmtRS(calc.dieselRS)}</td>
            </tr>
            <tr>
              <td>Manutenção</td>
              <td>− {fmtRS(calc.manutencaoRS)}</td>
            </tr>
            <tr>
              <td>Pedágio (sua parte)</td>
              <td>− {fmtRS(calc.pedagioRS)}</td>
            </tr>
            <tr className="total">
              <td>Lucro</td>
              <td>{fmtRS(calc.lucroRS)}</td>
            </tr>
          </tbody>
        </table>
        <div className="inline-fix">
          <label style={{ margin: 0, fontWeight: 500 }} htmlFor={`ped-${oferta.id}`}>
            Pedágio da carga (R$)
          </label>
          <NumInput
            id={`ped-${oferta.id}`}
            value={oferta.pedagioManualRS ?? null}
            placeholder="automático"
            aoSair
            onChange={(n) => onEditar({ pedagioManualRS: n })}
          />
        </div>
        {oferta.observacoes && <p className="hint">Obs.: {oferta.observacoes}</p>}
        {oferta.contato && <p className="hint">Contato: {oferta.contato}</p>}
      </details>
    </article>
  );
}
