"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icons";
import { Empty, Note, PageHead, Segmented } from "@/components/ui";
import { TripEditModal } from "@/components/TripEditModal";
import { exportarSemanaCSV } from "@/lib/export.ts";
import { fmtHoras, fmtKm, fmtRS0 } from "@/lib/format.ts";
import { useTruck, useViagens } from "@/lib/storage.ts";
import type { Viagem } from "@/lib/types.ts";

const DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function inicioDaSemana(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function dataLocal(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

function compacto(n: number): string {
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")}k` : String(Math.round(n));
}

function BarChart({ valores, tom }: { valores: number[]; tom: "gain" | "loss" | "fuel" }) {
  const max = Math.max(...valores.map((v) => Math.abs(v)), 1);
  const hoje = new Date().getDay();
  return (
    <div className={`bars ${tom === "loss" ? "loss" : tom === "fuel" ? "fuel" : ""}`} role="img" aria-label="Gráfico dos dias da semana">
      {valores.map((valor, i) => (
        <div className={`bar ${i === hoje ? "today" : ""}`} key={i}>
          <span className="bar-val">{valor ? compacto(valor) : "–"}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${Math.max(valor !== 0 ? 4 : 0, (Math.abs(valor) / max) * 100)}%` }} />
          </div>
          <span className="bar-lab">{DIA[i]}</span>
        </div>
      ))}
    </div>
  );
}

function FuelPerTripChart({ viagens }: { viagens: Viagem[] }) {
  if (viagens.length === 0) return null;
  const max = Math.max(...viagens.map((v) => v.dieselRealRS ?? v.dieselRS), 1);

  return (
    <div className="fuel-trip-chart" role="img" aria-label="Diesel por viagem">
      {viagens.slice(0, 7).map((v) => {
        const diesel = v.dieselRealRS ?? v.dieselRS;
        const pct = Math.max(8, (diesel / max) * 100);
        return (
          <div className="fuel-trip-row" key={v.id}>
            <div className="fuel-trip-info">
              <span className="fuel-trip-route">
                {v.origem} → {v.destino}
              </span>
              <span className="fuel-trip-val">{fmtRS0(diesel)}</span>
            </div>
            <div className="fuel-trip-track">
              <div className="fuel-trip-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function total(viagens: Viagem[], chave: keyof Viagem): number {
  return viagens.reduce((s, v) => s + Number(v[chave] ?? 0), 0);
}

export default function ViagensPage() {
  const router = useRouter();
  const [truck] = useTruck();
  const [viagens, setViagens, pronto] = useViagens();
  const [grafico, setGrafico] = useState<"LUCRO" | "GASTOS" | "DIESEL">("LUCRO");
  const [viagemEditando, setViagemEditando] = useState<Viagem | null>(null);

  const inicio = useMemo(() => inicioDaSemana(new Date()), []);
  const fim = useMemo(() => new Date(inicio.getTime() + 7 * 86400000), [inicio]);
  const semana = useMemo(
    () => viagens.filter((v) => { const d = new Date(v.realizadaEm); return d >= inicio && d < fim; }),
    [viagens, inicio, fim],
  );

  const porDia = useMemo(() => {
    const mapa = Array.from({ length: 7 }, () => ({ lucro: 0, custos: 0, diesel: 0, receita: 0 }));
    semana.forEach((v) => {
      const i = (new Date(v.realizadaEm).getDay() + 7) % 7;
      const l = v.lucroRealRS ?? v.lucroRS;
      const d = v.dieselRealRS ?? v.dieselRS;
      const p = v.pedagioRealRS ?? v.pedagioRS;
      const r = v.receitaRealRS ?? v.receitaRS;
      mapa[i].lucro += l;
      mapa[i].diesel += d;
      mapa[i].custos += d + v.manutencaoRS + p;
      mapa[i].receita += r;
    });
    return mapa;
  }, [semana]);

  const receita = semana.reduce((s, v) => s + (v.receitaRealRS ?? v.receitaRS), 0);
  const diesel = semana.reduce((s, v) => s + (v.dieselRealRS ?? v.dieselRS), 0);
  const pedagio = semana.reduce((s, v) => s + (v.pedagioRealRS ?? v.pedagioRS), 0);
  const manutencao = total(semana, "manutencaoRS");
  const custos = diesel + manutencao + pedagio;
  const lucro = receita - custos;
  const horas = total(semana, "horas");
  const km = total(semana, "kmTotal");
  const melhor = semana.length ? [...semana].sort((a, b) => b.lucroPorHoraRS - a.lucroPorHoraRS)[0] : null;

  // Separate in-progress vs completed
  const emAndamento = useMemo(
    () => semana.filter((v) => (v.status ?? "ESCOLHIDA") === "ESCOLHIDA"),
    [semana],
  );
  const concluidas = useMemo(
    () => semana.filter((v) => v.status === "CONCLUIDA"),
    [semana],
  );

  function excluir(id: string) {
    if (confirm("Remover esta viagem do painel?")) {
      setViagens((prev) => prev.filter((v) => v.id !== id));
    }
  }

  function salvarViagem(atualizada: Viagem) {
    setViagens((prev) => prev.map((v) => (v.id === atualizada.id ? atualizada : v)));
    setViagemEditando(null);
  }

  function exportar() {
    exportarSemanaCSV(viagens);
  }

  return (
    <>
      <PageHead
        eyebrow="Painel"
        title="Sua semana"
        lead="O que entrou, o que saiu do caixa e quanto realmente sobrou para o caminhão."
      />
      {!pronto ? (
        <div className="skel" />
      ) : (
        <>
          <div className="week-nav">
            <span>
              {dataLocal(inicio.toISOString())} a {dataLocal(new Date(fim.getTime() - 86400000).toISOString())}
            </span>
            <div className="week-actions">
              {semana.length > 0 && (
                <button type="button" className="btn ghost sm" onClick={exportar} title="Baixar planilha CSV da semana">
                  <Icon name="download" size={16} />
                  Exportar semana
                </button>
              )}
              <button type="button" className="btn ghost sm" onClick={() => router.push("/")}>
                <Icon name="plus" size={16} />
                Nova carga
              </button>
            </div>
          </div>

          <section className="hero" aria-label="Resumo da semana">
            <small>Lucro líquido da semana</small>
            <strong className={`hero-num ${lucro < 0 ? "neg" : ""}`}>{fmtRS0(lucro)}</strong>
            <small>
              {semana.length} {semana.length === 1 ? "viagem registrada" : "viagens registradas"}
              {horas > 0 ? ` · ${fmtHoras(horas)} na estrada` : ""}
              {km > 0 ? ` · ${fmtKm(km)}` : ""}
            </small>

            {/* Proportional breakdown bar: Diesel vs Pedagio vs Manutencao vs Lucro */}
            {receita > 0 && (
              <div className="distribution-bar" title="Distribuição da receita">
                <div
                  className="dist-segment dist-diesel"
                  style={{ width: `${Math.max(2, Math.min(100, (diesel / receita) * 100))}%` }}
                  title={`Diesel: ${fmtRS0(diesel)} (${Math.round((diesel / receita) * 100)}%)`}
                />
                <div
                  className="dist-segment dist-ped"
                  style={{ width: `${Math.max(2, Math.min(100, (pedagio / receita) * 100))}%` }}
                  title={`Pedágio: ${fmtRS0(pedagio)} (${Math.round((pedagio / receita) * 100)}%)`}
                />
                <div
                  className="dist-segment dist-manut"
                  style={{ width: `${Math.max(2, Math.min(100, (manutencao / receita) * 100))}%` }}
                  title={`Manutenção: ${fmtRS0(manutencao)} (${Math.round((manutencao / receita) * 100)}%)`}
                />
                {lucro > 0 && (
                  <div
                    className="dist-segment dist-lucro"
                    style={{ width: `${Math.max(2, Math.min(100, (lucro / receita) * 100))}%` }}
                    title={`Lucro líquido: ${fmtRS0(lucro)} (${Math.round((lucro / receita) * 100)}%)`}
                  />
                )}
              </div>
            )}

            <div className="hero-stats">
              <div>
                <strong>{fmtRS0(receita)}</strong>
                <small>Receita</small>
              </div>
              <div>
                <strong className="out">{fmtRS0(custos)}</strong>
                <small>Custos totais</small>
              </div>
              <div>
                <strong>{fmtRS0(manutencao)}</strong>
                <small>Manutenção</small>
              </div>
            </div>
          </section>

          {/* Maintenance reserve reminder */}
          {manutencao > 0 && (
            <div className="maintenance-reserve-card">
              <div className="maint-header">
                <Icon name="truck" size={20} />
                <strong>Reserva para o caminhão: {fmtRS0(manutencao)}</strong>
              </div>
              <p className="maint-text">
                Guarde este valor do caixa. Ele cobre desgaste de pneus, óleo, freios e revisões futuras ({fmtRS0(truck.custoKmRS * 100).replace(/,00$/, "")} a cada 100 km rodados).
              </p>
            </div>
          )}

          <section className="card">
            <div className="chart-top">
              <h2>
                {grafico === "LUCRO"
                  ? "Lucro por dia"
                  : grafico === "GASTOS"
                  ? "Custos por dia"
                  : "Diesel por viagem"}
              </h2>
              <Segmented
                label="Tipo de gráfico"
                value={grafico}
                onChange={setGrafico}
                options={[
                  { value: "LUCRO", label: "Lucro" },
                  { value: "GASTOS", label: "Custos" },
                  { value: "DIESEL", label: "Diesel" },
                ]}
              />
            </div>

            {grafico === "LUCRO" && (
              <>
                <BarChart valores={porDia.map((d) => d.lucro)} tom="gain" />
                <p className="hint">Lucro líquido diário após descontar combustível, pedágio e reserva de manutenção.</p>
              </>
            )}

            {grafico === "GASTOS" && (
              <>
                <BarChart valores={porDia.map((d) => d.custos)} tom="loss" />
                <div className="legend">
                  <span><i className="dot diesel" />Diesel {fmtRS0(diesel)}</span>
                  <span><i className="dot ped" />Pedágio {fmtRS0(pedagio)}</span>
                  <span><i className="dot manut" />Manutenção {fmtRS0(manutencao)}</span>
                </div>
              </>
            )}

            {grafico === "DIESEL" && (
              <>
                <FuelPerTripChart viagens={semana} />
                <div className="legend">
                  <span><i className="dot diesel" />Total diesel da semana: {fmtRS0(diesel)}</span>
                </div>
              </>
            )}
          </section>

          {melhor && (
            <Note tone="gain" icon="bolt">
              <strong>Melhor retorno por hora:</strong> {melhor.origem} → {melhor.destino}, {fmtRS0(melhor.lucroPorHoraRS)}/h.
            </Note>
          )}

          {/* Section: Em andamento */}
          {emAndamento.length > 0 && (
            <section className="trips-section">
              <div className="section-title-wrap">
                <h2>Cargas em andamento ({emAndamento.length})</h2>
                <span className="section-badge warn">Aguardando conclusão</span>
              </div>
              <p className="hint" style={{ margin: "-4px 0 12px" }}>
                Quando terminar a viagem, toque em <strong>Concluir</strong> para informar o diesel e pedágio reais.
              </p>
              {emAndamento.map((v) => (
                <article className="trip trip-in-progress" key={v.id}>
                  <div className="trip-status-band">
                    <span className="chip warn">
                      <Icon name="clock" size={14} />
                      Em andamento
                    </span>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setViagemEditando(v)}
                    >
                      <Icon name="check" size={16} />
                      Concluir / Ajustar
                    </button>
                  </div>

                  <div className="trip-route">
                    {v.origem}
                    <Icon name="arrow" size={20} />
                    {v.destino}
                  </div>
                  <div className="trip-meta">
                    <span className="chip">{DIA[new Date(v.realizadaEm).getDay()]}, {dataLocal(v.realizadaEm)}</span>
                    <span className="chip">{fmtKm(v.kmTotal)}</span>
                    <span className="chip">{fmtHoras(v.horas)}</span>
                    <span className="chip">{v.toneladas}t</span>
                  </div>
                  <div className="trip-finance">
                    <div>
                      <small>Lucro previsto</small>
                      <strong className={v.lucroRS >= 0 ? "gain-text" : "loss-text"}>{fmtRS0(v.lucroRS)}</strong>
                    </div>
                    <div>
                      <small>Por hora</small>
                      <strong>{fmtRS0(v.lucroPorHoraRS)}</strong>
                    </div>
                    <div>
                      <small>Diesel est.</small>
                      <strong>{fmtRS0(v.dieselRS)}</strong>
                    </div>
                    <div>
                      <small>Manutenção</small>
                      <strong>{fmtRS0(v.manutencaoRS)}</strong>
                    </div>
                  </div>
                  <div className="trip-foot-actions">
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => setViagemEditando(v)}
                    >
                      <Icon name="edit" size={16} />
                      Editar valores
                    </button>
                    <button
                      type="button"
                      className="btn ghost icon"
                      onClick={() => excluir(v.id)}
                      aria-label={`Remover viagem ${v.origem} para ${v.destino}`}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}

          {/* Section: Concluídas */}
          <section className="trips-section">
            <div className="section-title-wrap">
              <h2>Viagens concluídas ({concluidas.length})</h2>
              {concluidas.length > 0 && <span className="section-badge gain">Histórico real</span>}
            </div>
            {concluidas.length === 0 && emAndamento.length === 0 ? (
              <Empty icon="truck" title="Nenhuma viagem ainda">
                Analise as cargas e toque em <strong>Escolher e registrar</strong> para ela aparecer aqui.
              </Empty>
            ) : concluidas.length === 0 ? (
              <p className="hint" style={{ padding: "16px 0" }}>
                Nenhuma viagem marcada como concluída ainda nesta semana.
              </p>
            ) : (
              [...concluidas]
                .sort((a, b) => b.realizadaEm.localeCompare(a.realizadaEm))
                .map((v) => {
                  const lucroExibido = v.lucroRealRS ?? v.lucroRS;
                  const dieselExibido = v.dieselRealRS ?? v.dieselRS;
                  const temReal = v.lucroRealRS != null || v.dieselRealRS != null || v.receitaRealRS != null;

                  return (
                    <article className="trip" key={v.id}>
                      <div className="trip-status-band">
                        <span className="chip gain">
                          <Icon name="check" size={14} />
                          Concluída {temReal && "· Valores Reais"}
                        </span>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setViagemEditando(v)}
                        >
                          <Icon name="edit" size={16} />
                          Editar
                        </button>
                      </div>
                      <div className="trip-route">
                        {v.origem}
                        <Icon name="arrow" size={20} />
                        {v.destino}
                      </div>
                      <div className="trip-meta">
                        <span className="chip">{DIA[new Date(v.realizadaEm).getDay()]}, {dataLocal(v.realizadaEm)}</span>
                        <span className="chip">{fmtKm(v.kmTotal)}</span>
                        <span className="chip">{fmtHoras(v.horas)}</span>
                        <span className="chip">{v.toneladas}t</span>
                      </div>
                      <div className="trip-finance">
                        <div>
                          <small>Lucro real</small>
                          <strong className={lucroExibido >= 0 ? "gain-text" : "loss-text"}>{fmtRS0(lucroExibido)}</strong>
                        </div>
                        <div>
                          <small>Por hora</small>
                          <strong>{fmtRS0(v.lucroPorHoraRS)}</strong>
                        </div>
                        <div>
                          <small>Diesel {v.dieselRealRS != null ? "real" : "est."}</small>
                          <strong>{fmtRS0(dieselExibido)}</strong>
                        </div>
                        <div>
                          <small>Manutenção</small>
                          <strong>{fmtRS0(v.manutencaoRS)}</strong>
                        </div>
                      </div>
                      <div className="trip-foot-actions">
                        <button
                          type="button"
                          className="btn ghost icon"
                          onClick={() => excluir(v.id)}
                          aria-label={`Remover viagem ${v.origem} para ${v.destino}`}
                        >
                          <Icon name="trash" size={18} />
                        </button>
                      </div>
                    </article>
                  );
                })
            )}
          </section>

          {/* Trip edit modal */}
          {viagemEditando && (
            <TripEditModal
              viagem={viagemEditando}
              onSalvar={salvarViagem}
              onFechar={() => setViagemEditando(null)}
            />
          )}
        </>
      )}
    </>
  );
}
