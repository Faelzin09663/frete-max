"use client";
import { Icon } from "@/components/Icons";
import { NumInput } from "@/components/NumInput";
import { Field, PageHead } from "@/components/ui";
import { fmtRS } from "@/lib/format.ts";
import { useLocais, useTruck } from "@/lib/storage.ts";
import type { Truck } from "@/lib/types.ts";

export default function CaminhaoPage() {
  const [t, setT] = useTruck();
  const [locais] = useLocais();
  const set = <K extends keyof Truck>(k: K, v: Truck[K]) => setT((prev) => ({ ...prev, [k]: v }));

  const custoCheio = t.consumoCheioKmL > 0 ? t.dieselRSL / t.consumoCheioKmL + t.custoKmRS : 0;
  const custoVazio = t.consumoVazioKmL > 0 ? t.dieselRSL / t.consumoVazioKmL + t.custoKmRS : 0;

  return (
    <>
      <PageHead eyebrow="Caminhão" title="Custos e tempo" lead="Tudo é salvo sozinho. Os valores iniciais são exemplos: troque pelos seus." />

      <section className="insight" aria-label="Custo por quilômetro">
        <div>
          <small>Custo por km cheio</small>
          <strong>{fmtRS(custoCheio)}</strong>
        </div>
        <div>
          <small>Custo por km vazio</small>
          <strong>{fmtRS(custoVazio)}</strong>
        </div>
        <p>Diesel + manutenção, sem pedágio. É o mínimo que cada km precisa render.</p>
      </section>

      <h2 className="sect-title">
        <Icon name="truck" size={24} />
        Veículo
      </h2>
      <section className="card">
        <Field label="Apelido do caminhão" htmlFor="nome">
          <input id="nome" value={t.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Meu caminhão" />
        </Field>
        <Field label="Capacidade de carga" htmlFor="cap" unit="t">
          <NumInput id="cap" value={t.capacidadeT} onChange={(n) => set("capacidadeT", n)} />
        </Field>
      </section>

      <h2 className="sect-title">
        <Icon name="fuel" size={24} />
        Consumo e custos
      </h2>
      <section className="card">
        <div className="grid2">
          <Field label="Consumo cheio" htmlFor="cc" unit="km/l">
            <NumInput id="cc" value={t.consumoCheioKmL} onChange={(n) => set("consumoCheioKmL", n)} />
          </Field>
          <Field label="Consumo vazio" htmlFor="cv" unit="km/l">
            <NumInput id="cv" value={t.consumoVazioKmL} onChange={(n) => set("consumoVazioKmL", n)} />
          </Field>
        </div>
        <div className="grid2">
          <Field label="Diesel" htmlFor="d" unit="R$/l">
            <NumInput id="d" value={t.dieselRSL} onChange={(n) => set("dieselRSL", n)} />
          </Field>
          <Field label="Manutenção" htmlFor="mk" unit="R$/km">
            <NumInput id="mk" value={t.custoKmRS} onChange={(n) => set("custoKmRS", n)} />
          </Field>
        </div>
        <p className="hint">Manutenção inclui pneus, óleo, peças e desgaste. Se não souber, comece com 1,00 a 1,50.</p>
      </section>

      <h2 className="sect-title">
        <Icon name="clock" size={24} />
        Tempo
      </h2>
      <section className="card">
        <div className="grid2">
          <Field label="Carregar" htmlFor="tc" unit="h">
            <NumInput id="tc" value={t.tempoCargaH} onChange={(n) => set("tempoCargaH", n)} />
          </Field>
          <Field label="Descarregar" htmlFor="td" unit="h">
            <NumInput id="td" value={t.tempoDescargaH} onChange={(n) => set("tempoDescargaH", n)} />
          </Field>
        </div>
        <Field label="Lentidão do caminhão vs. carro" htmlFor="ft" unit="×" hint="1,3 significa que o caminhão leva 30% mais tempo que o Google Maps mostra.">
          <NumInput id="ft" value={t.fatorTempo} onChange={(n) => set("fatorTempo", n)} />
        </Field>
      </section>

      <h2 className="sect-title">
        <Icon name="pin" size={24} />
        Base
      </h2>
      <section className="card">
        <Field label="Onde o caminhão costuma voltar" htmlFor="base" hint="Usada para contar o retorno vazio no cálculo, se você ativar na tela de cargas.">
          <select id="base" value={t.baseLocalId ?? ""} onChange={(e) => set("baseLocalId", e.target.value || null)}>
            <option value="">Nenhuma</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.apelido}
              </option>
            ))}
          </select>
        </Field>
      </section>
    </>
  );
}
