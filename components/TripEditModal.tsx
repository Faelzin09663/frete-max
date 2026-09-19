"use client";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { NumInput } from "@/components/NumInput";
import { fmtRS0 } from "@/lib/format.ts";
import type { Viagem } from "@/lib/types.ts";

export function TripEditModal({
  viagem,
  onSalvar,
  onFechar,
}: {
  viagem: Viagem;
  onSalvar: (atualizada: Viagem) => void;
  onFechar: () => void;
}) {
  const [receitaReal, setReceitaReal] = useState<number | null>(viagem.receitaRealRS ?? null);
  const [dieselReal, setDieselReal] = useState<number | null>(viagem.dieselRealRS ?? null);
  const [pedagioReal, setPedagioReal] = useState<number | null>(viagem.pedagioRealRS ?? null);

  function salvar(concluir: boolean) {
    const rr = receitaReal ?? viagem.receitaRS;
    const dr = dieselReal ?? viagem.dieselRS;
    const pr = pedagioReal ?? viagem.pedagioRS;
    const custoReal = dr + viagem.manutencaoRS + pr;
    const lucroReal = rr - custoReal;

    onSalvar({
      ...viagem,
      status: concluir ? "CONCLUIDA" : viagem.status,
      receitaRealRS: receitaReal,
      dieselRealRS: dieselReal,
      pedagioRealRS: pedagioReal,
      lucroRealRS: lucroReal,
    });
  }

  const estimadoReceita = viagem.receitaRS;
  const estimadoDiesel = viagem.dieselRS;
  const estimadoPedagio = viagem.pedagioRS;

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Editar viagem</h2>
          <button type="button" className="btn ghost icon" onClick={onFechar} aria-label="Fechar">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="modal-route">
          <strong>{viagem.origem}</strong>
          <Icon name="arrow" size={18} />
          <strong>{viagem.destino}</strong>
        </div>

        <p className="hint" style={{ margin: "0 0 16px" }}>
          Preencha os valores reais. Campos vazios usam a estimativa original.
        </p>

        <div className="modal-field">
          <label htmlFor="ed-receita">
            Receita recebida
            <small>Estimativa: {fmtRS0(estimadoReceita)}</small>
          </label>
          <div className="inp has-unit">
            <NumInput
              id="ed-receita"
              value={receitaReal}
              placeholder={String(Math.round(estimadoReceita))}
              onChange={setReceitaReal}
            />
            <span className="unit">R$</span>
          </div>
        </div>

        <div className="modal-field">
          <label htmlFor="ed-diesel">
            Diesel gasto
            <small>Estimativa: {fmtRS0(estimadoDiesel)}</small>
          </label>
          <div className="inp has-unit">
            <NumInput
              id="ed-diesel"
              value={dieselReal}
              placeholder={String(Math.round(estimadoDiesel))}
              onChange={setDieselReal}
            />
            <span className="unit">R$</span>
          </div>
        </div>

        <div className="modal-field">
          <label htmlFor="ed-pedagio">
            Pedágio pago
            <small>Estimativa: {fmtRS0(estimadoPedagio)}</small>
          </label>
          <div className="inp has-unit">
            <NumInput
              id="ed-pedagio"
              value={pedagioReal}
              placeholder={String(Math.round(estimadoPedagio))}
              onChange={setPedagioReal}
            />
            <span className="unit">R$</span>
          </div>
        </div>

        <div className="modal-preview">
          <span>Lucro real estimado:</span>
          <strong className={(((receitaReal ?? viagem.receitaRS) - (dieselReal ?? viagem.dieselRS) - viagem.manutencaoRS - (pedagioReal ?? viagem.pedagioRS)) >= 0) ? "gain-text" : "loss-text"}>
            {fmtRS0(
              (receitaReal ?? viagem.receitaRS) -
              (dieselReal ?? viagem.dieselRS) -
              viagem.manutencaoRS -
              (pedagioReal ?? viagem.pedagioRS)
            )}
          </strong>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn ghost block" onClick={() => salvar(false)}>
            <Icon name="check" size={18} />
            Salvar
          </button>
          {viagem.status === "ESCOLHIDA" && (
            <button type="button" className="btn block" onClick={() => salvar(true)}>
              <Icon name="trophy" size={18} />
              Concluir viagem
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
