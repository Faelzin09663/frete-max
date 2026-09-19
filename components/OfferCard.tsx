"use client";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { NumInput } from "@/components/NumInput";
import { RouteMap } from "@/components/RouteMap";
import { Note } from "@/components/ui";
import { fmtHoras, fmtKm, fmtRS, fmtRS0 } from "@/lib/format.ts";
import type { CalcResult, MapaDados, Oferta } from "@/lib/types.ts";

export type Selo = "LUCRO" | "HORA";

const VIAB = {
  OK: { txt: "Dá tempo de chegar", cls: "gain" },
  ARRISCADO: { txt: "Horário apertado", cls: "warn" },
  INVIAVEL: { txt: "Não chega a tempo", cls: "loss" },
} as const;

function textoSelo(selos: Selo[]): string {
  if (selos.length === 2) return "⚡ MELHOR ESCOLHA · CUSTO-BENEFÍCIO E LUCRO";
  return selos[0] === "HORA" ? "⚡ MELHOR CUSTO-BENEFÍCIO (R$/H)" : "💰 MAIOR LUCRO TOTAL";
}

export function OfferCard({
  oferta,
  origemNome,
  destinoNome,
  calc,
  mapa,
  selos,
  onEditar,
  onEscolher,
}: {
  oferta: Oferta;
  origemNome: string;
  destinoNome: string;
  calc: CalcResult;
  mapa: MapaDados | null;
  selos: Selo[];
  onEditar: (patch: Partial<Oferta>) => void;
  onEscolher?: () => void;
}) {
  const [mapaAberto, setMapaAberto] = useState(false);
  const valor = oferta.valorManual ?? oferta.valor;
  const semValor = valor == null;
  const positivo = calc.lucroRS >= 0;
  const viab = calc.viabilidade !== "DESCONHECIDA" ? VIAB[calc.viabilidade] : null;
  const kmPct = Math.max(0, Math.min(100, calc.pctVazio * 100));
  const unidade = oferta.valorManual != null || oferta.unidade === "TONELADA" ? "/t" : oferta.unidade === "VIAGEM" ? "/viagem" : "";

  return (
    <article className={`load ${selos.length ? "best" : ""} ${calc.viabilidade === "INVIAVEL" ? "dim" : ""}`}>
      {selos.length > 0 && (
        <div className="load-band">
          <Icon name="bolt" size={16} />
          {textoSelo(selos)}
        </div>
      )}

      <div className="stops">
        <div className="stop from">
          <i className="pin" />
          <div>
            <small>Carrega em</small>
            <strong>{origemNome}</strong>
          </div>
        </div>
        <div className="stop to">
          <i className="pin" />
          <div>
            <small>Descarrega em</small>
            <strong>{destinoNome}</strong>
          </div>
        </div>
      </div>

      <div className="chips">
        {oferta.origemMsg && <span className="chip">{oferta.origemMsg}</span>}
        {valor != null && (
          <span className="chip">
            Frete {fmtRS(valor)}
            {unidade}
          </span>
        )}
        {viab && (
          <span className={`chip ${viab.cls}`}>
            {viab.txt}
            {calc.margemMin != null && calc.viabilidade !== "INVIAVEL" ? ` · folga ${fmtHoras(calc.margemMin / 60)}` : ""}
          </span>
        )}
        {oferta.agendamento === "PLACA_MARCADA" && <span className="chip warn">Placa marcada: ligue antes</span>}
        {oferta.agendamento === "SEM_AGENDAMENTO" && <span className="chip">Sem agendamento</span>}
        {oferta.carregamentoAte && <span className="chip">Carregar até {oferta.carregamentoAte}</span>}
        {oferta.descargaAte && <span className="chip">Descarga até {oferta.descargaAte}</span>}
        {oferta.pedagio === "REEMBOLSADO" && <span className="chip gain">Pedágio reembolsado</span>}
        {oferta.pedagio === "POR_CONTA_DO_MOTORISTA" && <span className="chip warn">Pedágio por sua conta</span>}
      </div>

      {semValor ? (
        <div className="needs">
          <label htmlFor={`val-${oferta.id}`} style={{ display: "block", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            Sem preço na mensagem. Digite o frete por tonelada
          </label>
          <div className="inp has-unit">
            <NumInput id={`val-${oferta.id}`} value={oferta.valorManual ?? null} placeholder="0,00" aoSair onChange={(n) => onEditar({ valorManual: n })} />
            <span className="unit">R$/t</span>
          </div>
        </div>
      ) : (
        <>
          <div className="kpis">
            <div className={`kpi main ${positivo ? "gain" : "loss"}`}>
              <span>Lucro na viagem</span>
              <strong>{fmtRS0(calc.lucroRS)}</strong>
            </div>
            <div className="kpi">
              <span>Por hora</span>
              <strong>{fmtRS0(calc.lucroPorHoraRS)}</strong>
            </div>
          </div>
          <div className="minis">
            <div>
              <strong>{fmtHoras(calc.horas)}</strong>
              <small>tempo total</small>
            </div>
            <div>
              <strong>{fmtKm(calc.kmTotal)}</strong>
              <small>distância</small>
            </div>
            <div>
              <strong>{fmtRS(calc.lucroPorKmRS)}</strong>
              <small>lucro por km</small>
            </div>
          </div>
        </>
      )}

      <div className="road" role="img" aria-label={`${fmtKm(calc.kmVazio + calc.kmRetorno)} vazio e ${fmtKm(calc.kmCheio)} cheio`}>
        <div className="empty-km" style={{ width: `${kmPct}%` }} />
        <div className="full-km" style={{ width: `${100 - kmPct}%` }} />
      </div>
      <div className="roadlab">
        <span>
          <i className="v" />
          Vazio {fmtKm(calc.kmVazio + calc.kmRetorno)}
        </span>
        <span>
          <i />
          Cheio {fmtKm(calc.kmCheio)}
        </span>
      </div>

      {calc.avisos.map((a) => (
        <Note key={a} tone="warn">
          {a}
        </Note>
      ))}

      {mapa && (
        <details className="acc" onToggle={(e) => setMapaAberto((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>
            <Icon name="map" size={20} />
            Ver no mapa
            <Icon name="chevron" size={20} className="chev" />
          </summary>
          {mapaAberto && <RouteMap dados={mapa} />}
        </details>
      )}

      <details className="acc">
        <summary>
          <Icon name="calc" size={20} />
          Ver a conta
          <Icon name="chevron" size={20} className="chev" />
        </summary>
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
          <label htmlFor={`ped-${oferta.id}`}>Pedágio da carga (R$)</label>
          <NumInput id={`ped-${oferta.id}`} value={oferta.pedagioManualRS ?? null} placeholder="automático" aoSair onChange={(n) => onEditar({ pedagioManualRS: n })} />
        </div>
        {valor != null && (
          <div className="inline-fix">
            <label htmlFor={`fr-${oferta.id}`}>Corrigir frete (R$/t)</label>
            <NumInput id={`fr-${oferta.id}`} value={oferta.valorManual ?? null} placeholder={String(oferta.valor ?? "")} aoSair onChange={(n) => onEditar({ valorManual: n })} />
          </div>
        )}
        {oferta.observacoes && <p className="hint">Obs.: {oferta.observacoes}</p>}
        {oferta.contato && <p className="hint">Contato: {oferta.contato}</p>}
      </details>

      {onEscolher && !semValor && (
        <button type="button" className="btn block" onClick={onEscolher}>
          <Icon name="check" size={22} />
          Escolher e registrar
        </button>
      )}
    </article>
  );
}
