"use client";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { LocalPicker } from "@/components/LocalPicker";
import { NumInput } from "@/components/NumInput";
import type { Local, Oferta, Unidade, Pedagio } from "@/lib/types.ts";

/** Campos que a IA pode ter deduzido (aparecem em amarelo na conferência). */
function foiDeduzido(oferta: Oferta, campo: string): boolean {
  if (campo === "unidade" && oferta.unidade === "DESCONHECIDA") return true;
  if (campo === "pedagio" && oferta.pedagio === "NAO_INFORMADO") return true;
  if (campo === "valor" && oferta.valor == null) return true;
  return false;
}

function EditCard({
  oferta,
  index,
  locais,
  lembrarOrigem,
  lembrarDestino,
  onLembrar,
  onNovoLocal,
  onChange,
}: {
  oferta: Oferta;
  index: number;
  locais: Local[];
  lembrarOrigem: boolean;
  lembrarDestino: boolean;
  onLembrar: (lado: "o" | "d", v: boolean) => void;
  onNovoLocal: (l: Local) => void | Promise<void>;
  onChange: (patch: Partial<Oferta>) => void;
}) {
  return (
    <article className="review-card">
      <div className="review-header">
        <span className="review-num">{index + 1}</span>
        <strong>Carga {index + 1}</strong>
      </div>

      <div className="review-grid">
        <div className="review-field">
          <label>Origem</label>
          <input
            value={oferta.origemTexto}
            onChange={(e) => onChange({ origemTexto: e.target.value })}
          />
          <LocalPicker
            papel="origem"
            texto={oferta.origemTexto}
            escolhidoId={oferta.origemLocalId}
            locais={locais}
            lembrar={lembrarOrigem}
            onEscolher={(id) => onChange({ origemLocalId: id })}
            onLembrar={(v) => onLembrar("o", v)}
            onNovoLocal={onNovoLocal}
          />
        </div>
        <div className="review-field">
          <label>Destino</label>
          <input
            value={oferta.destinoTexto}
            onChange={(e) => onChange({ destinoTexto: e.target.value })}
          />
          <LocalPicker
            papel="destino"
            texto={oferta.destinoTexto}
            escolhidoId={oferta.destinoLocalId}
            locais={locais}
            lembrar={lembrarDestino}
            onEscolher={(id) => onChange({ destinoLocalId: id })}
            onLembrar={(v) => onLembrar("d", v)}
            onNovoLocal={onNovoLocal}
          />
        </div>
      </div>

      <div className="review-grid">
        <div className={`review-field ${foiDeduzido(oferta, "valor") ? "ai-guess" : ""}`}>
          <label>
            Valor do frete
            {foiDeduzido(oferta, "valor") && <span className="ai-tag">IA não encontrou</span>}
          </label>
          <div className="inp has-unit">
            <NumInput
              value={oferta.valor}
              placeholder="0,00"
              onChange={(n) => onChange({ valor: n })}
            />
            <span className="unit">R$</span>
          </div>
        </div>
        <div className={`review-field ${foiDeduzido(oferta, "unidade") ? "ai-guess" : ""}`}>
          <label>
            Unidade
            {foiDeduzido(oferta, "unidade") && <span className="ai-tag">IA deduziu</span>}
          </label>
          <select
            value={oferta.unidade}
            onChange={(e) => onChange({ unidade: e.target.value as Unidade })}
          >
            <option value="TONELADA">Por tonelada</option>
            <option value="VIAGEM">Por viagem</option>
            <option value="DESCONHECIDA">Não sei</option>
          </select>
        </div>
      </div>

      <div className="review-grid">
        <div className={`review-field ${foiDeduzido(oferta, "pedagio") ? "ai-guess" : ""}`}>
          <label>
            Pedágio
            {foiDeduzido(oferta, "pedagio") && <span className="ai-tag">IA deduziu</span>}
          </label>
          <select
            value={oferta.pedagio}
            onChange={(e) => onChange({ pedagio: e.target.value as Pedagio })}
          >
            <option value="REEMBOLSADO">Reembolsado</option>
            <option value="POR_CONTA_DO_MOTORISTA">Por minha conta</option>
            <option value="NAO_INFORMADO">Não informado</option>
          </select>
        </div>
        <div className="review-field">
          <label>Carregar até</label>
          <input
            type="time"
            value={oferta.carregamentoAte ?? ""}
            onChange={(e) => onChange({ carregamentoAte: e.target.value || null })}
          />
        </div>
      </div>

      {oferta.observacoes && (
        <div className="review-obs">
          <Icon name="alert" size={14} />
          <span>{oferta.observacoes}</span>
        </div>
      )}
      {oferta.contato && (
        <div className="review-obs">
          <Icon name="user" size={14} />
          <span>{oferta.contato}</span>
        </div>
      )}
    </article>
  );
}

export function ReviewScreen({
  ofertas,
  locais,
  onNovoLocal,
  onLembrarNome,
  onConfirmar,
  onVoltar,
}: {
  ofertas: Oferta[];
  locais: Local[];
  onNovoLocal: (l: Local) => void | Promise<void>;
  onLembrarNome: (localId: string, nome: string) => void;
  onConfirmar: (corrigidas: Oferta[]) => void;
  onVoltar: () => void;
}) {
  const [editadas, setEditadas] = useState<Oferta[]>(ofertas);
  // "lembrar este nome para o local escolhido" (começa desligado: nomes genéricos como
  // "Sete Lagoas" não devem virar sinônimo de uma mineradora só)
  const [lembrar, setLembrar] = useState<Record<string, boolean>>({});

  function confirmar() {
    for (const o of editadas) {
      if (lembrar[`${o.id}:o`] && o.origemLocalId) onLembrarNome(o.origemLocalId, o.origemTexto);
      if (lembrar[`${o.id}:d`] && o.destinoLocalId) onLembrarNome(o.destinoLocalId, o.destinoTexto);
    }
    onConfirmar(editadas);
  }

  function atualizar(index: number, patch: Partial<Oferta>) {
    setEditadas((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  const temDeduzido = editadas.some(
    (o) => foiDeduzido(o, "unidade") || foiDeduzido(o, "pedagio") || foiDeduzido(o, "valor"),
  );

  return (
    <section className="review-screen">
      <header className="review-top">
        <button type="button" className="btn ghost sm" onClick={onVoltar}>
          <Icon name="arrow" size={18} className="flip-h" />
          Voltar
        </button>
        <h2>Conferir leitura da IA</h2>
      </header>

      <p className="lead" style={{ marginBottom: 4 }}>
        Confira o que a IA entendeu de cada carga. Se houver mais de um lugar com o mesmo nome (como várias
        mineradoras na mesma cidade), escolha o local certo em cada carga.
      </p>

      {temDeduzido && (
        <div className="note warn" style={{ marginBottom: 16 }}>
          <Icon name="alert" size={18} />
          <div>
            Campos em <strong>amarelo</strong> foram deduzidos pela IA. Verifique se estão certos.
          </div>
        </div>
      )}

      {editadas.map((o, i) => (
        <EditCard
          key={o.id}
          oferta={o}
          index={i}
          locais={locais}
          lembrarOrigem={!!lembrar[`${o.id}:o`]}
          lembrarDestino={!!lembrar[`${o.id}:d`]}
          onLembrar={(lado, v) => setLembrar((prev) => ({ ...prev, [`${o.id}:${lado}`]: v }))}
          onNovoLocal={onNovoLocal}
          onChange={(p) => atualizar(i, p)}
        />
      ))}

      <div className="sticky-cta" style={{ background: "linear-gradient(to top, var(--bg) 68%, transparent)" }}>
        <button
          type="button"
          className="btn block"
          onClick={confirmar}
        >
          <Icon name="check" size={22} />
          Confirmar e calcular
        </button>
      </div>
    </section>
  );
}
