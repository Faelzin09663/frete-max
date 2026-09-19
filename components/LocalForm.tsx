"use client";
import { useId, useState } from "react";
import { Field } from "@/components/ui";
import { Note } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { geocodificar } from "@/lib/client-api.ts";
import { novoId } from "@/lib/storage.ts";
import type { Local } from "@/lib/types.ts";

export function LocalForm({
  apelidoInicial = "",
  sinonimoInicial = "",
  onSalvar,
  rotulo = "Salvar local",
}: {
  apelidoInicial?: string;
  sinonimoInicial?: string;
  onSalvar: (l: Local) => void;
  rotulo?: string;
}) {
  const uid = useId();
  const [apelido, setApelido] = useState(apelidoInicial);
  const [sinonimos, setSinonimos] = useState(sinonimoInicial);
  const [endereco, setEndereco] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function salvar() {
    setErro(null);
    if (!apelido.trim() || !endereco.trim()) {
      setErro("Preencha o apelido e o endereço.");
      return;
    }
    setBusy(true);
    try {
      const g = await geocodificar(endereco);
      onSalvar({
        id: novoId(),
        apelido: apelido.trim(),
        sinonimos: sinonimos.split(",").map((s) => s.trim()).filter(Boolean),
        endereco: g.formatado,
        lat: g.lat,
        lng: g.lng,
      });
      setApelido("");
      setSinonimos("");
      setEndereco("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Field label="Apelido (como aparece nas mensagens)" htmlFor={`${uid}-ap`}>
        <input id={`${uid}-ap`} value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Ex.: Extrativa" autoCapitalize="words" />
      </Field>
      <Field label="Endereço ou coordenadas" htmlFor={`${uid}-end`} hint="Dica: no Google Maps, segure o dedo no ponto e copie os números que aparecem.">
        <input id={`${uid}-end`} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, cidade  —  ou  -19.9245, -43.9352" />
      </Field>
      <Field label="Outros nomes (separe por vírgula)" htmlFor={`${uid}-sin`}>
        <input id={`${uid}-sin`} value={sinonimos} onChange={(e) => setSinonimos(e.target.value)} placeholder="Ex.: Mina Extrativa, Extrativa Mineral" />
      </Field>
      {erro && <Note tone="loss">{erro}</Note>}
      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn block" onClick={salvar} disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="pin" size={20} />}
          {busy ? "Buscando endereço..." : rotulo}
        </button>
      </div>
    </div>
  );
}
