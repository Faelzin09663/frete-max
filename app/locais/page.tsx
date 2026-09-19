"use client";
import { LocalForm } from "@/components/LocalForm";
import { useLocais } from "@/lib/storage.ts";

export default function LocaisPage() {
  const [locais, setLocais, pronto] = useLocais();

  return (
    <>
      <h1>Locais</h1>
      <p className="lead">
        As mensagens só trazem nomes como “Extrativa” ou “Rocha”. Cadastre cada um uma vez, com o endereço certo.
      </p>

      <div className="panel">
        <LocalForm onSalvar={(l) => setLocais((prev) => [...prev, l])} />
      </div>

      <h2>Cadastrados</h2>
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
