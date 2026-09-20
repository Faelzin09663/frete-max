"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { RouteMap } from "@/components/RouteMap";
import { Note, Segmented } from "@/components/ui";
import { getLeg } from "@/lib/client-api.ts";
import { fmtHoras, fmtKm, fmtRS0 } from "@/lib/format.ts";
import { montarMapaPlano } from "@/lib/mapa.ts";
import { fmtRelogio, planejarRefinando, type Carga, type Plano } from "@/lib/plano.ts";
import { useCampoSessao } from "@/lib/sessao";
import type { Local, Truck } from "@/lib/types.ts";

const VIAB = {
  OK: { txt: "Horários ok", cls: "gain" },
  ARRISCADO: { txt: "Horário apertado", cls: "warn" },
  INVIAVEL: { txt: "Não chega a tempo", cls: "loss" },
} as const;

function PlanoCard({
  plano,
  posicao,
  inicial,
  onEscolher,
}: {
  plano: Plano;
  posicao: number;
  inicial: boolean;
  onEscolher: () => void;
}) {
  const [mapaAberto, setMapaAberto] = useState(false);
  const positivo = plano.lucroRS >= 0;
  const kmPct = Math.max(0, Math.min(100, plano.pctVazio * 100));
  const viab = plano.viabilidade !== "DESCONHECIDA" ? VIAB[plano.viabilidade] : null;

  return (
    <article className={`plano-card ${posicao === 0 ? "best" : ""}`}>
      {posicao === 0 && (
        <div className="load-band">
          <Icon name="trophy" size={16} />
          Melhor sequência
        </div>
      )}

      <header className="plano-top">
        <span className="rank" aria-label={`${posicao + 1}ª opção`}>
          {posicao + 1}º
        </span>
        <div>
          <small>{plano.passos.length === 1 ? "1 carga" : `${plano.passos.length} cargas em fila`}</small>
          <strong className="chain">{plano.titulo}</strong>
        </div>
      </header>

      <div className="why">
        <b>{posicao === 0 ? "Pegue essa porque:" : "Como fica:"}</b>
        <p>{plano.explicacao.join(" ")}</p>
      </div>

      {(plano.motivos.length > 0 || viab) && (
        <div className="chips">
          {plano.motivos.map((m) => (
            <span className="chip gain" key={m}>
              {m}
            </span>
          ))}
          {viab && <span className={`chip ${viab.cls}`}>{viab.txt}</span>}
        </div>
      )}

      <div className="kpis">
        <div className={`kpi main ${positivo ? "gain" : "loss"}`}>
          <span>Lucro total</span>
          <strong>{fmtRS0(plano.lucroRS)}</strong>
        </div>
        <div className="kpi">
          <span>Por hora</span>
          <strong>{fmtRS0(plano.lucroPorHoraRS)}</strong>
        </div>
      </div>
      <div className="minis">
        <div>
          <strong>{fmtHoras(plano.horas)}</strong>
          <small>tempo total</small>
        </div>
        <div>
          <strong>{fmtKm(plano.kmTotal)}</strong>
          <small>distância</small>
        </div>
        <div>
          <strong>{Math.round(plano.pctVazio * 100)}%</strong>
          <small>vazio</small>
        </div>
      </div>

      <div className="road" role="img" aria-label={`${fmtKm(plano.kmVazio)} vazio e ${fmtKm(plano.kmCheio)} cheio`}>
        <div className="empty-km" style={{ width: `${kmPct}%` }} />
        <div className="full-km" style={{ width: `${100 - kmPct}%` }} />
      </div>
      <div className="roadlab">
        <span>
          <i className="v" />
          Vazio {fmtKm(plano.kmVazio)}
        </span>
        <span>
          <i />
          Cheio {fmtKm(plano.kmCheio)}
        </span>
      </div>

      {plano.avisos.map((a) => (
        <Note key={a} tone="warn">
          {a}
        </Note>
      ))}

      <details className="acc" open={inicial}>
        <summary>
          <Icon name="road" size={20} />
          Ver trecho a trecho
          <Icon name="chevron" size={20} className="chev" />
        </summary>
        <ol className="tl">
          <li className="tl-ponto">
            <i />
            <div>
              <strong>Saída · {plano.inicio.apelido}</strong>
              {plano.saidaMin != null && <small>{fmtRelogio(plano.saidaMin)}</small>}
            </div>
          </li>
          {plano.passos.map((s, i) => (
            <li key={s.carga.oferta.id} className="tl-bloco">
              {s.vazio.km >= 1 && (
                <div className="tl-vazio">
                  Vazio {fmtKm(s.vazio.km)} até {s.carga.origem.apelido}
                </div>
              )}
              <div className="tl-ponto">
                <i />
                <div>
                  <strong>
                    {i + 1}º carrega em {s.carga.origem.apelido}
                  </strong>
                  <small>
                    {s.chegadaMin != null ? `chega ${fmtRelogio(s.chegadaMin)}` : ""}
                    {s.margemMin != null && s.viabilidade !== "INVIAVEL" ? ` · folga ${fmtHoras(s.margemMin / 60)}` : ""}
                    {s.carga.oferta.carregamentoAte ? ` · limite ${s.carga.oferta.carregamentoAte}` : ""}
                    {s.carga.oferta.agendamento === "PLACA_MARCADA" ? " · placa marcada" : ""}
                  </small>
                </div>
              </div>
              <div className="tl-cheio">
                Carregado {fmtKm(s.cheio.km)} · frete {fmtRS0(s.calc.receitaRS)}
              </div>
              <div className="tl-ponto to">
                <i />
                <div>
                  <strong>
                    {i + 1}º descarrega em {s.carga.destino.apelido}
                  </strong>
                  {s.descargaMin != null && <small>termina ~{fmtRelogio(s.descargaMin)}</small>}
                </div>
              </div>
            </li>
          ))}
          {plano.fim && plano.retorno && (
            <li className="tl-bloco">
              {plano.retorno.km >= 1 && (
                <div className="tl-vazio">
                  Vazio {fmtKm(plano.retorno.km)} de volta para {plano.fim.apelido}
                </div>
              )}
              <div className="tl-ponto fim">
                <i />
                <div>
                  <strong>Chegada · {plano.fim.apelido}</strong>
                  {plano.fimMin != null && <small>~{fmtRelogio(plano.fimMin)}</small>}
                </div>
              </div>
            </li>
          )}
        </ol>
      </details>

      <details className="acc" onToggle={(e) => setMapaAberto((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>
          <Icon name="map" size={20} />
          Ver no mapa
          <Icon name="chevron" size={20} className="chev" />
        </summary>
        {mapaAberto && <RouteMap dados={montarMapaPlano(plano)} />}
      </details>

      <details className="acc">
        <summary>
          <Icon name="calc" size={20} />
          Ver a conta
          <Icon name="chevron" size={20} className="chev" />
        </summary>
        <table className="break">
          <tbody>
            <tr>
              <td>Frete das {plano.passos.length} carga(s)</td>
              <td>{fmtRS0(plano.receitaRS)}</td>
            </tr>
            <tr>
              <td>Diesel</td>
              <td>− {fmtRS0(plano.dieselRS)}</td>
            </tr>
            <tr>
              <td>Manutenção</td>
              <td>− {fmtRS0(plano.manutencaoRS)}</td>
            </tr>
            <tr>
              <td>Pedágio (sua parte)</td>
              <td>− {fmtRS0(plano.pedagioRS)}</td>
            </tr>
            <tr className="total">
              <td>Lucro</td>
              <td>{fmtRS0(plano.lucroRS)}</td>
            </tr>
          </tbody>
        </table>
      </details>

      <button type="button" className={posicao === 0 ? "btn block" : "btn ghost block"} onClick={onEscolher}>
        <Icon name="check" size={22} />
        Escolher esta sequência
      </button>
    </article>
  );
}

export function PlanoPanel({
  cargas,
  excluidas,
  truck,
  inicio,
  base,
  toneladas,
  agoraMin,
  onEscolher,
}: {
  cargas: Carga[];
  excluidas: number;
  truck: Truck;
  inicio: Local | null;
  base: Local | null;
  toneladas: number;
  agoraMin: number | null;
  onEscolher: (p: Plano) => void;
}) {
  const [plano, setPlano] = useCampoSessao("plano");
  const [ordem, setOrdem] = useCampoSessao("ordem");
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const fim = plano.voltar && base ? base : null;

  useEffect(() => {
    if (!plano.ativo || !inicio) {
      setPlanos([]);
      return;
    }
    let cancelado = false;
    setCalculando(true);
    setErro(null);
    setProgresso(null);
    planejarRefinando(
      { inicio, fim, cargas, truck, toneladas, inicioMin: agoraMin, maxCargas: plano.maxCargas, objetivo: ordem, prazoH: null, top: 3 },
      getLeg,
      { onProgresso: (feitos, total) => !cancelado && setProgresso({ feitos, total }) },
    )
      .then((r) => {
        if (cancelado) return;
        setPlanos(r);
        setCalculando(false);
      })
      .catch((e) => {
        if (cancelado) return;
        setErro(e instanceof Error ? e.message : "Não consegui montar a sequência.");
        setCalculando(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano.ativo, plano.maxCargas, plano.voltar, ordem, cargas, truck, toneladas, agoraMin, inicio?.id, fim?.id]);

  return (
    <section className="plano" aria-label="Melhor sequência de cargas">
      <div className="plano-head">
        <span className="ic">
          <Icon name="road" size={24} />
        </span>
        <div>
          <h2>Melhor sequência</h2>
          <p>
            Combino as cargas em fila, saindo de casa e voltando, e mostro em que ordem sobra mais dinheiro. Testo{" "}
            {cargas.length} cargas em todas as ordens possíveis.
          </p>
        </div>
      </div>

      {!inicio ? (
        <Note tone="warn" icon="pin">
          Para montar a sequência preciso saber de onde você sai. Escolha <b>Onde você está agora</b> ou defina a{" "}
          <b>Base</b> em Caminhão.
        </Note>
      ) : (
        <>
          <p className="plano-saida">
            <Icon name="pin" size={16} />
            Saindo de <b>{inicio.apelido}</b>
            {fim ? (
              <>
                {" "}
                e voltando para <b>{fim.apelido}</b>
              </>
            ) : (
              " (sem contar a volta)"
            )}
          </p>

          <div className="plano-cfg">
            <div className="field">
              <label>Até quantas cargas em fila</label>
              <Segmented
                label="Máximo de cargas"
                value={String(plano.maxCargas)}
                onChange={(v) => setPlano((p) => ({ ...p, maxCargas: Number(v) }))}
                options={["2", "3", "4", "5"].map((v) => ({ value: v, label: v }))}
              />
            </div>
            <div className="field">
              <label>Melhor é a que dá mais</label>
              <Segmented
                label="Critério do ranking"
                value={ordem}
                onChange={setOrdem}
                options={[
                  { value: "HORA", label: "Lucro por hora" },
                  { value: "LUCRO", label: "Lucro total" },
                ]}
              />
            </div>
            {base && (
              <label className="switch">
                <span>
                  Voltar para {base.apelido} no final
                  <small>Soma o km vazio da volta</small>
                </span>
                <input
                  className="sw"
                  type="checkbox"
                  checked={plano.voltar}
                  onChange={(e) => setPlano((p) => ({ ...p, voltar: e.target.checked }))}
                />
              </label>
            )}
          </div>

          {excluidas > 0 && (
            <Note tone="warn">
              {excluidas} {excluidas === 1 ? "carga ficou" : "cargas ficaram"} de fora por falta de preço ou de local
              cadastrado.
            </Note>
          )}

          {!plano.ativo ? (
            <button type="button" className="btn block" onClick={() => setPlano((p) => ({ ...p, ativo: true }))}>
              <Icon name="bolt" size={22} />
              Montar melhor sequência
            </button>
          ) : (
            <button type="button" className="btn ghost block" onClick={() => setPlano((p) => ({ ...p, ativo: false }))}>
              Ocultar sequências
            </button>
          )}
        </>
      )}

      {erro && (
        <Note tone="loss" icon="alert">
          {erro}
        </Note>
      )}

      {calculando && (
        <div className="calc-status">
          <span className="spinner" aria-hidden="true" />
          {progresso && progresso.total > 0
            ? `Conferindo rotas reais: ${progresso.feitos} de ${progresso.total}...`
            : "Testando as combinações..."}
        </div>
      )}

      {plano.ativo && !calculando && !erro && inicio && planos.length === 0 && (
        <Note tone="warn">
          Nenhuma sequência é possível com esses horários. Confira a <b>hora agora</b> e os limites de carregamento.
        </Note>
      )}

      {planos.map((p, i) => (
        <PlanoCard key={p.titulo + i} plano={p} posicao={i} inicial={i === 0} onEscolher={() => onEscolher(p)} />
      ))}
    </section>
  );
}
