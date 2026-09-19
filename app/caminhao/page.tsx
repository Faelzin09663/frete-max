"use client";
import { NumInput } from "@/components/NumInput";
import { useLocais, useTruck } from "@/lib/storage.ts";
import type { Truck } from "@/lib/types.ts";

export default function CaminhaoPage() {
  const [t, setT] = useTruck();
  const [locais] = useLocais();
  const set = <K extends keyof Truck>(k: K, v: Truck[K]) => setT((prev) => ({ ...prev, [k]: v }));

  return (
    <>
      <h1>Caminhão e custos</h1>
      <p className="lead">Tudo é salvo sozinho. Os valores iniciais são exemplos: troque pelos seus.</p>

      <div className="panel">
        <label htmlFor="cap">Capacidade de carga (toneladas)</label>
        <NumInput id="cap" value={t.capacidadeT} onChange={(n) => set("capacidadeT", n)} />
        <div className="row2">
          <div>
            <label htmlFor="cc">Consumo cheio (km/l)</label>
            <NumInput id="cc" value={t.consumoCheioKmL} onChange={(n) => set("consumoCheioKmL", n)} />
          </div>
          <div>
            <label htmlFor="cv">Consumo vazio (km/l)</label>
            <NumInput id="cv" value={t.consumoVazioKmL} onChange={(n) => set("consumoVazioKmL", n)} />
          </div>
        </div>
        <div className="row2">
          <div>
            <label htmlFor="d">Diesel (R$/litro)</label>
            <NumInput id="d" value={t.dieselRSL} onChange={(n) => set("dieselRSL", n)} />
          </div>
          <div>
            <label htmlFor="mk">Manutenção (R$/km)</label>
            <NumInput id="mk" value={t.custoKmRS} onChange={(n) => set("custoKmRS", n)} />
          </div>
        </div>
        <div className="hint">Manutenção inclui pneus, óleo, peças e desgaste. Se não souber, comece com 1,00 a 1,50.</div>
      </div>

      <h2>Tempo</h2>
      <div className="panel">
        <div className="row2">
          <div>
            <label htmlFor="tc">Carregar (horas)</label>
            <NumInput id="tc" value={t.tempoCargaH} onChange={(n) => set("tempoCargaH", n)} />
          </div>
          <div>
            <label htmlFor="td">Descarregar (horas)</label>
            <NumInput id="td" value={t.tempoDescargaH} onChange={(n) => set("tempoDescargaH", n)} />
          </div>
        </div>
        <label htmlFor="ft">Lentidão do caminhão vs. carro</label>
        <NumInput id="ft" value={t.fatorTempo} onChange={(n) => set("fatorTempo", n)} />
        <div className="hint">1,3 significa que o caminhão leva 30% mais tempo que o Google Maps mostra.</div>
      </div>

      <h2>Base</h2>
      <div className="panel">
        <label htmlFor="base">Onde o caminhão costuma voltar</label>
        <select id="base" value={t.baseLocalId ?? ""} onChange={(e) => set("baseLocalId", e.target.value || null)}>
          <option value="">Nenhuma</option>
          {locais.map((l) => (
            <option key={l.id} value={l.id}>
              {l.apelido}
            </option>
          ))}
        </select>
        <div className="hint">Usada para contar o retorno vazio no cálculo, se você ativar na tela de cargas.</div>
      </div>
    </>
  );
}
