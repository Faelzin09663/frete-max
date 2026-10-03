"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icons";
import { Empty, PageHead, Segmented } from "@/components/ui";
import { fmtHoras, fmtKm, fmtRS, fmtRS0 } from "@/lib/format.ts";
import { useCargas } from "@/lib/storage.ts";
import type { CargaSalva } from "@/lib/types.ts";

type Periodo = "HOJE" | "7D" | "30D" | "TUDO";
type FiltroStatus = "TODAS" | "ANALISADA" | "ESCOLHIDA";

function dataHoraLocal(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const dataTxt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
  const horaTxt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
  return `${mesmoDia ? "Hoje" : dataTxt} · ${horaTxt}`;
}

function dentroDoPeriodo(iso: string, periodo: Periodo): boolean {
  if (periodo === "TUDO") return true;
  const dias = periodo === "HOJE" ? 1 : periodo === "7D" ? 7 : 30;
  const limite = Date.now() - dias * 86400000;
  return new Date(iso).getTime() >= limite;
}

function unidadeTxt(c: CargaSalva): string {
  return c.unidade === "TONELADA" ? "/t" : c.unidade === "VIAGEM" ? "/viagem" : "";
}

export default function CargasPage() {
  const router = useRouter();
  const [cargas, setCargas, pronto] = useCargas();
  const [periodo, setPeriodo] = useState<Periodo>("7D");
  const [status, setStatus] = useState<FiltroStatus>("TODAS");
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");

  const empresas = useMemo(
    () => [...new Set(cargas.map((c) => c.empresa).filter((v): v is string => !!v))].sort(),
    [cargas],
  );
  const grupos = useMemo(
    () => [...new Set(cargas.map((c) => c.grupo).filter((v): v is string => !!v))].sort(),
    [cargas],
  );

  const filtradas = useMemo(
    () =>
      cargas
        .filter((c) => dentroDoPeriodo(c.analisadaEm, periodo))
        .filter((c) => status === "TODAS" || c.status === status)
        .filter((c) => !empresaFiltro || c.empresa === empresaFiltro)
        .filter((c) => !grupoFiltro || c.grupo === grupoFiltro)
        .sort((a, b) => b.analisadaEm.localeCompare(a.analisadaEm)),
    [cargas, periodo, status, empresaFiltro, grupoFiltro],
  );

  function excluir(c: CargaSalva) {
    if (confirm(`Remover a carga ${c.origemTexto} → ${c.destinoTexto} do histórico?`)) {
      setCargas((prev) => prev.filter((x) => x.id !== c.id));
    }
  }

  return (
    <>
      <PageHead eyebrow="Histórico" title="Cargas" lead="Todas as cargas que você já analisou, escolhidas ou não." />

      {!pronto ? (
        <div className="skel" />
      ) : (
        <>
          <div className="field" style={{ marginTop: 0 }}>
            <label>Período</label>
            <Segmented
              label="Período"
              value={periodo}
              onChange={setPeriodo}
              options={[
                { value: "HOJE", label: "Hoje" },
                { value: "7D", label: "7 dias" },
                { value: "30D", label: "30 dias" },
                { value: "TUDO", label: "Tudo" },
              ]}
            />
          </div>
          <div className="field">
            <label>Status</label>
            <Segmented
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "TODAS", label: "Todas" },
                { value: "ESCOLHIDA", label: "Escolhidas" },
                { value: "ANALISADA", label: "Só analisadas" },
              ]}
            />
          </div>
          {(empresas.length > 1 || grupos.length > 1) && (
            <div className="grid2">
              {empresas.length > 1 && (
                <div className="field" style={{ marginTop: 0 }}>
                  <label htmlFor="fEmpresa">Empresa</label>
                  <select id="fEmpresa" value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)}>
                    <option value="">Todas as empresas</option>
                    {empresas.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {grupos.length > 1 && (
                <div className="field" style={{ marginTop: 0 }}>
                  <label htmlFor="fGrupo">Grupo</label>
                  <select id="fGrupo" value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value)}>
                    <option value="">Todos os grupos</option>
                    {grupos.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <p className="hint" style={{ margin: "16px 0 8px" }}>
            <Icon name="cargas" size={14} /> {filtradas.length} {filtradas.length === 1 ? "carga" : "cargas"}
            {periodo !== "TUDO" || status !== "TODAS" || empresaFiltro || grupoFiltro ? " com esse filtro" : " analisadas"}
          </p>

          {filtradas.length === 0 ? (
            <Empty icon="cargas" title="Nada por aqui ainda">
              {cargas.length === 0 ? (
                <>
                  Cole uma mensagem de frete em <strong>Analise</strong> — toda carga calculada aparece aqui.
                </>
              ) : (
                "Nenhuma carga bate com esse filtro."
              )}
            </Empty>
          ) : (
            filtradas.map((c) => {
              const valor = c.valor;
              return (
                <article className="trip" key={c.id}>
                  <div className="trip-status-band">
                    <span className={`chip ${c.status === "ESCOLHIDA" ? "gain" : ""}`}>
                      <Icon name={c.status === "ESCOLHIDA" ? "check" : "clock"} size={14} />
                      {c.status === "ESCOLHIDA" ? "Escolhida" : "Apenas analisada"}
                    </span>
                    <button type="button" className="btn ghost icon" onClick={() => excluir(c)} aria-label={`Remover carga ${c.origemTexto} para ${c.destinoTexto}`}>
                      <Icon name="trash" size={18} />
                    </button>
                  </div>

                  <p className="hint" style={{ margin: "0 0 6px" }}>
                    {dataHoraLocal(c.analisadaEm)}
                    {c.empresa ? ` · ${c.empresa}` : ""}
                  </p>

                  <div className="trip-route">
                    {c.origemTexto}
                    <Icon name="arrow" size={20} />
                    {c.destinoTexto}
                  </div>

                  <div className="trip-meta">
                    {c.grupo && <span className="chip">Grupo: {c.grupo}</span>}
                    {valor != null && (
                      <span className="chip">
                        {fmtRS(valor)}
                        {unidadeTxt(c)}
                      </span>
                    )}
                    {c.kmTotal != null && <span className="chip">{fmtKm(c.kmTotal)}</span>}
                    {c.horas != null && <span className="chip">{fmtHoras(c.horas)}</span>}
                  </div>

                  {c.lucroRS != null && (
                    <div className="trip-finance">
                      <div>
                        <small>Lucro</small>
                        <strong className={c.lucroRS >= 0 ? "gain-text" : "loss-text"}>{fmtRS0(c.lucroRS)}</strong>
                      </div>
                      <div>
                        <small>Por hora</small>
                        <strong>{fmtRS0(c.lucroPorHoraRS ?? 0)}</strong>
                      </div>
                      {c.kmVazio != null && (
                        <div>
                          <small>Km vazio</small>
                          <strong>{fmtKm(c.kmVazio)}</strong>
                        </div>
                      )}
                      {c.kmCheio != null && (
                        <div>
                          <small>Km cheio</small>
                          <strong>{fmtKm(c.kmCheio)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {c.status !== "ESCOLHIDA" && (
                    <div className="trip-foot-actions">
                      <button type="button" className="btn ghost sm" onClick={() => router.push("/")}>
                        <Icon name="bolt" size={16} />
                        Ir para Analise
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </>
      )}
    </>
  );
}
