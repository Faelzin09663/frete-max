"use client";
import { useState } from "react";
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
      <label>Apelido (como aparece nas mensagens)</label>
      <input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Ex.: Extrativa" />
      <label>Endereço ou coordenadas</label>
      <input
        value={endereco}
        onChange={(e) => setEndereco(e.target.value)}
        placeholder="Rua, cidade  —  ou  -19.9245, -43.9352"
      />
      <div className="hint">Dica: no Google Maps, segure o dedo no ponto e copie os números que aparecem.</div>
      <label>Outros nomes (separe por vírgula)</label>
      <input value={sinonimos} onChange={(e) => setSinonimos(e.target.value)} placeholder="Ex.: Mina Extrativa, Extrativa Mineral" />
      {erro && <div className="error">{erro}</div>}
      <div className="actions">
        <button onClick={salvar} disabled={busy}>
          {busy ? "Buscando endereço..." : rotulo}
        </button>
      </div>
    </div>
  );
}
