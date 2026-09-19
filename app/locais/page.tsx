"use client";
import { LocalForm } from "@/components/LocalForm";
import { useLocais } from "@/lib/storage.ts";

export default function LocaisPage() {
  const [locais, setLocais, pronto] = useLocais();

  const exportarJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(locais, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `locais-fretemax-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copiarJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(locais, null, 2));
      alert("JSON com todos os locais copiado para a área de transferência!");
    } catch {
      alert("Não foi possível copiar automaticamente. Use a opção de baixar o arquivo .json.");
    }
  };

  const importarJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const importados = JSON.parse(String(ev.target?.result));
        if (Array.isArray(importados)) {
          setLocais((prev) => {
            const idsExistentes = new Set(prev.map((p) => p.id));
            const novos = importados.filter((i) => !idsExistentes.has(i.id));
            return [...prev, ...novos];
          });
          alert(`${importados.length} local(is) importado(s) com sucesso!`);
        } else {
          alert("O arquivo não contém uma lista válida de locais.");
        }
      } catch {
        alert("Erro ao processar o arquivo JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <>
      <h1>Locais</h1>
      <p className="lead">
        As mensagens só trazem nomes como “Extrativa” ou “Rocha”. Cadastre cada um uma vez, com o endereço certo.
      </p>

      <div className="panel">
        <LocalForm onSalvar={(l) => setLocais((prev) => [...prev, l])} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Cadastrados ({locais.length})</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {locais.length > 0 && (
            <>
              <button type="button" className="small" onClick={copiarJSON} title="Copiar lista de locais como JSON">
                📋 Copiar JSON
              </button>
              <button type="button" className="small" onClick={exportarJSON} title="Baixar arquivo .json com todos os locais">
                💾 Baixar .json
              </button>
            </>
          )}
          <label className="small" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", border: "2px solid var(--line)", borderRadius: "var(--radius)", padding: "6px 14px", fontWeight: 600, fontSize: 15, background: "var(--card)" }}>
            📥 Importar .json
            <input type="file" accept=".json,application/json" onChange={importarJSON} style={{ display: "none" }} />
          </label>
        </div>
      </div>
      {pronto && locais.length === 0 && <div className="empty">Nenhum local ainda. Cadastre o primeiro acima.</div>}
      {locais.map((l) => (
        <div className="panel" key={l.id}>
          <div className="list-item">
            <div>
              <strong>{l.apelido}</strong>
              <div className="hint">{l.endereco}</div>
              {l.sinonimos.length > 0 && <div className="hint">Também: {l.sinonimos.join(", ")}</div>}
            </div>
            <button
              className="small danger"
              onClick={() => {
                if (confirm(`Apagar ${l.apelido}?`)) setLocais((prev) => prev.filter((x) => x.id !== l.id));
              }}
            >
              Apagar
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
