"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icons";
import { LocalForm } from "@/components/LocalForm";
import { Empty, PageHead } from "@/components/ui";
import { normalizar } from "@/lib/match.ts";
import { useLocais } from "@/lib/storage.ts";

export default function LocaisPage() {
  const [locais, setLocais, pronto] = useLocais();
  const [novo, setNovo] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const q = normalizar(busca);
    return [...locais]
      .sort((a, b) => a.apelido.localeCompare(b.apelido, "pt-BR"))
      .filter((l) => !q || normalizar([l.apelido, l.endereco, ...l.sinonimos].join(" ")).includes(q));
  }, [locais, busca]);

  const mostrarForm = novo || (pronto && locais.length === 0);
  const editando = locais.find((l) => l.id === editandoId) ?? null;

  return (
    <>
      <PageHead
        eyebrow="Locais"
        title="Seus pontos"
        lead="As mensagens só trazem nomes como “Extrativa” ou “Rocha”. Cadastre cada um uma vez, com o endereço certo."
      />

      {mostrarForm ? (
        <section className="card">
          <div className="row between" style={{ marginBottom: 6 }}>
            <strong style={{ fontFamily: "var(--font-num)", fontSize: 22 }}>Novo local</strong>
            {locais.length > 0 && (
              <button type="button" className="btn ghost icon" onClick={() => setNovo(false)} aria-label="Fechar formulário">
                <Icon name="x" size={18} />
              </button>
            )}
          </div>
          <LocalForm
            onSalvar={(l) => {
              setLocais((prev) => [...prev, l]);
              setNovo(false);
            }}
          />
        </section>
      ) : (
        <button type="button" className="btn block" onClick={() => setNovo(true)} style={{ marginBottom: 6 }}>
          <Icon name="plus" size={22} />
          Cadastrar local
        </button>
      )}

      {editando && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <strong style={{ fontFamily: "var(--font-num)", fontSize: 22 }}>Editar local</strong>
            <button type="button" className="btn ghost icon" onClick={() => setEditandoId(null)} aria-label="Fechar edição">
              <Icon name="x" size={18} />
            </button>
          </div>
          <LocalForm
            localInicial={editando}
            rotulo="Salvar alterações"
            onCancelar={() => setEditandoId(null)}
            onSalvar={(local) => {
              setLocais((prev) => prev.map((l) => (l.id === local.id ? local : l)));
              setEditandoId(null);
            }}
          />
        </section>
      )}

      <h2>Cadastrados{locais.length > 0 ? ` (${locais.length})` : ""}</h2>

      {locais.length > 5 && (
        <div className="search">
          <Icon name="search" size={20} />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar local" aria-label="Buscar local" />
        </div>
      )}

      {pronto && locais.length === 0 && (
        <Empty icon="pin" title="Nenhum local ainda">
          Cadastre o primeiro acima.
        </Empty>
      )}
      {pronto && locais.length > 0 && lista.length === 0 && <p className="hint">Nenhum local encontrado para “{busca}”.</p>}

      {lista.map((l) => (
        <div className="place" key={l.id}>
          <div className="ic">
            <Icon name="pin" size={22} />
          </div>
          <div className="body">
            <strong>{l.apelido}</strong>
            <div className="addr">{l.endereco}</div>
            {l.sinonimos.length > 0 && (
              <div className="chips">
                {l.sinonimos.map((s) => (
                  <span className="chip" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn ghost icon"
            aria-label={`Editar ${l.apelido}`}
            onClick={() => {
              setNovo(false);
              setEditandoId(l.id);
            }}
          >
            <Icon name="edit" size={18} />
          </button>
          <button
            type="button"
            className="btn ghost icon"
            aria-label={`Apagar ${l.apelido}`}
            onClick={() => {
              if (confirm(`Apagar ${l.apelido}?`)) setLocais((prev) => prev.filter((x) => x.id !== l.id));
            }}
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
      ))}
    </>
  );
}
