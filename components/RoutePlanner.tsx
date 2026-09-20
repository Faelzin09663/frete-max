"use client";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { NumInput } from "@/components/NumInput";
import { RouteMap } from "@/components/RouteMap";
import { Note, Segmented } from "@/components/ui";
import { fmtHoras, fmtKm, fmtRS0 } from "@/lib/format.ts";
import type { MapaDados } from "@/lib/types.ts";
import type { ResultadoRotas, Sequencia } from "@/lib/rota.ts";

const VIAB_TXT: Record<string, string> = {
  OK: "Dá tempo",
  ARRISCADO: "Horário apertado",
  INVIAVEL: "Não chega a tempo",
};

function rotaTexto(seq: Sequencia, posNome: string, baseNome: string | null): string {
  const partes = [posNome, ...seq.etapas.flatMap((e) => [e.origem.apelido, e.destino.apelido])];
  if (seq.retorno && baseNome) partes.push(baseNome);
  // remove repetições consecutivas (quando a origem da próxima carga é o mesmo ponto do destino anterior)
  return partes.filter((p, i) => p !== partes[i - 1]).join(" → ");
}

function Timeline({ seq, posNome, baseNome }: { seq: Sequencia; posNome: string; baseNome: string | null }) {
  const paradas: { nome: string; papel: "POSICAO" | "ORIGEM" | "DESTINO" | "BASE"; viab?: string; margem?: number | null }[] = [
    { nome: posNome, papel: "POSICAO" },
  ];
  seq.etapas.forEach((e) => {
    paradas.push({ nome: e.origem.apelido, papel: "ORIGEM", viab: e.viabilidade, margem: e.margemMin });
    paradas.push({ nome: e.destino.apelido, papel: "DESTINO" });
  });
  if (seq.retorno && baseNome) paradas.push({ nome: baseNome, papel: "BASE" });

  return (
    <div className="stops">
      {paradas.map((p, i) => (
        <div className={`stop ${p.papel === "DESTINO" ? "to" : ""}`} key={`${p.nome}-${i}`}>
          <i className="pin" />
          <div>
            <small>
              {p.papel === "POSICAO" ? "Sai de" : p.papel === "BASE" ? "Volta para" : p.papel === "ORIGEM" ? "Carrega em" : "Descarrega em"}
            </small>
            <strong>{p.nome}</strong>
            {p.viab && (
              <span className={`chip ${p.viab === "OK" ? "gain" : p.viab === "ARRISCADO" ? "warn" : "loss"}`} style={{ marginTop: 6 }}>
                {VIAB_TXT[p.viab]}
                {p.margem != null && p.viab !== "INVIAVEL" ? ` · folga ${fmtHoras(Math.max(0, p.margem) / 60)}` : ""}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SequenciaCard({ seq, posNome, baseNome, mapa, destaque }: { seq: Sequencia; posNome: string; baseNome: string | null; mapa: MapaDados | null; destaque: boolean }) {
  const [mapaAberto, setMapaAberto] = useState(false);
  const positivo = seq.lucroRS >= 0;
  const kmPct = Math.max(0, Math.min(100, seq.pctVazio * 100));

  return (
    <article className={`load ${destaque ? "best" : ""} ${seq.viabilidade === "INVIAVEL" ? "dim" : ""}`}>
      {destaque && (
        <div className="load-band">
          <Icon name="road" size={16} />
          MELHOR SEQUÊNCIA · {seq.etapas.length} {seq.etapas.length === 1 ? "carga" : "cargas"}
        </div>
      )}
      <Timeline seq={seq} posNome={posNome} baseNome={baseNome} />

      <div className="kpis">
        <div className={`kpi main ${positivo ? "gain" : "loss"}`}>
          <span>Lucro da sequência</span>
          <strong>{fmtRS0(seq.lucroRS)}</strong>
        </div>
        <div className="kpi">
          <span>Por hora</span>
          <strong>{fmtRS0(seq.lucroPorHoraRS)}</strong>
        </div>
      </div>
      <div className="minis">
        <div>
          <strong>{fmtHoras(seq.horas)}</strong>
          <small>tempo total</small>
        </div>
        <div>
          <strong>{fmtKm(seq.kmTotal)}</strong>
          <small>distância</small>
        </div>
        <div>
          <strong>{Math.round(seq.pctVazio * 100)}%</strong>
          <small>km vazio</small>
        </div>
      </div>

      <div className="road" role="img" aria-label={`${fmtKm(seq.kmVazio)} vazio e ${fmtKm(seq.kmCheio)} cheio`}>
        <div className="empty-km" style={{ width: `${kmPct}%` }} />
        <div className="full-km" style={{ width: `${100 - kmPct}%` }} />
      </div>
      <div className="roadlab">
        <span>
          <i className="v" />
          Vazio {fmtKm(seq.kmVazio)}
        </span>
        <span>
          <i />
          Cheio {fmtKm(seq.kmCheio)}
        </span>
      </div>

      {seq.avisos.map((a) => (
        <Note key={a} tone="warn">
          {a}
        </Note>
      ))}

      {mapa && (
        <details className="acc" onToggle={(e) => setMapaAberto((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>
            <Icon name="map" size={20} />
            Ver a sequência no mapa
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
              <td>Frete (todas as cargas)</td>
              <td>{fmtRS0(seq.receitaRS)}</td>
            </tr>
            <tr>
              <td>Diesel</td>
              <td>− {fmtRS0(seq.dieselRS)}</td>
            </tr>
            <tr>
              <td>Manutenção</td>
              <td>− {fmtRS0(seq.manutencaoRS)}</td>
            </tr>
            <tr>
              <td>Pedágio (sua parte)</td>
              <td>− {fmtRS0(seq.pedagioRS)}</td>
            </tr>
            <tr className="total">
              <td>Lucro</td>
              <td>{fmtRS0(seq.lucroRS)}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </article>
  );
}

export function RoutePlanner({
  resultado,
  carregando,
  posNome,
  baseNome,
  mapaMelhor,
  maxParadas,
  onMaxParadas,
  prazoVoltaH,
  onPrazoVoltaH,
}: {
  resultado: ResultadoRotas | null;
  carregando: boolean;
  posNome: string;
  baseNome: string | null;
  mapaMelhor: MapaDados | null;
  maxParadas: number;
  onMaxParadas: (n: number) => void;
  prazoVoltaH: number | null;
  onPrazoVoltaH: (n: number | null) => void;
}) {
  const [melhor, ...outras] = resultado?.melhores ?? [];

  return (
    <section aria-label="Planejamento de rota">
      <div className="results-head">
        <div>
          <h2 className="sect-title">
            <Icon name="road" size={22} />
            Sequência de cargas
          </h2>
          <p className="hint">
            {posNome}
            {baseNome ? ` (volta para ${baseNome})` : ""} — testa a ordem das cargas pra achar o trajeto que mais rende
          </p>
        </div>
      </div>

      <div className="card">
        <div className="grid2">
          <div className="field" style={{ marginTop: 0 }}>
            <label>Cargas por sequência</label>
            <Segmented
              label="Cargas por sequência"
              value={String(maxParadas)}
              onChange={(v) => onMaxParadas(Number(v))}
              options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>
          <div className="field" style={{ marginTop: 0 }}>
            <label htmlFor="prazoVolta">Prazo pra voltar (opcional)</label>
            <div className="inp has-unit">
              <NumInput id="prazoVolta" value={prazoVoltaH} placeholder="sem limite" aoSair onChange={onPrazoVoltaH} />
              <span className="unit">h</span>
            </div>
          </div>
        </div>
      </div>

      {carregando && (
        <div className="calc-status">
          <span className="spinner" aria-hidden="true" />
          Calculando a melhor sequência...
        </div>
      )}

      {!carregando && resultado && resultado.melhores.length === 0 && (
        <Note tone="warn" icon="alert">
          Nenhuma sequência deu pra calcular ainda. Confira se as cargas têm frete e locais cadastrados.
        </Note>
      )}

      {!carregando && resultado && resultado.maxParadasUsado < maxParadas && (
        <Note tone="warn" icon="alert">
          Muitas propostas de uma vez: testei sequências de até {resultado.maxParadasUsado} carga(s) por vez para não travar o aparelho.
        </Note>
      )}

      {!carregando && resultado && !resultado.prazoRespeitado && prazoVoltaH != null && (
        <Note tone="warn" icon="clock">
          Nenhuma sequência coube nas {fmtHoras(prazoVoltaH)} pedidas. Mostrando a melhor mesmo assim.
        </Note>
      )}

      {melhor && (
        <>
          <SequenciaCard seq={melhor} posNome={posNome} baseNome={baseNome} mapa={mapaMelhor} destaque />
          {resultado && resultado.combinacoesTestadas > 1 && (
            <p className="hint" style={{ margin: "-6px 0 16px" }}>
              {resultado.combinacoesTestadas} ordens testadas, sem gastar API de rota extra por ordem.
            </p>
          )}
        </>
      )}

      {outras.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Outras opções</h3>
          {outras.map((seq, i) => (
            <article className="trip" key={i}>
              <div className="trip-route">
                <Icon name="road" size={18} />
                <span>{rotaTexto(seq, posNome, baseNome)}</span>
              </div>
              <div className="trip-finance">
                <div>
                  <small>Lucro</small>
                  <strong className={seq.lucroRS >= 0 ? "gain-text" : "loss-text"}>{fmtRS0(seq.lucroRS)}</strong>
                </div>
                <div>
                  <small>Por hora</small>
                  <strong className={seq.lucroPorHoraRS >= 0 ? "gain-text" : "loss-text"}>{fmtRS0(seq.lucroPorHoraRS)}</strong>
                </div>
                <div>
                  <small>Tempo</small>
                  <strong>{fmtHoras(seq.horas)}</strong>
                </div>
                <div>
                  <small>Km vazio</small>
                  <strong>{Math.round(seq.pctVazio * 100)}%</strong>
                </div>
              </div>
            </article>
          ))}
        </>
      )}

      {resultado && resultado.foraDaRota.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, margin: "18px 0 8px" }}>Ficaram de fora da melhor sequência</h3>
          <div className="chips">
            {resultado.foraDaRota.map((p) => (
              <span className="chip" key={p.oferta.id}>
                {p.origem.apelido} → {p.destino.apelido}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
