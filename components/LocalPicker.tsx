"use client";
import { useId, useMemo, useState } from "react";
import { LocalForm } from "@/components/LocalForm";
import { candidatosLocais, ehAmbiguo, normalizar } from "@/lib/match.ts";
import type { Local } from "@/lib/types.ts";

const NOVO = "__novo__";

function resumo(endereco: string): string {
  const t = endereco.replace(/,?\s*Brasil$/i, "").trim();
  return t.length > 44 ? `${t.slice(0, 43)}…` : t;
}
const rotuloLocal = (l: Local) => (l.endereco ? `${l.apelido} — ${resumo(l.endereco)}` : l.apelido);

/**
 * Escolha do local certo para o nome que veio na mensagem.
 * Útil quando há vários lugares parecidos (ex.: 3 mineradoras em Sete Lagoas):
 * o endereço aparece no seletor e embaixo, com link para ver no mapa.
 */
export function LocalPicker({
  papel,
  texto,
  escolhidoId,
  locais,
  lembrar,
  onEscolher,
  onLembrar,
  onNovoLocal,
}: {
  papel: "origem" | "destino";
  texto: string;
  escolhidoId: string | null | undefined;
  locais: Local[];
  lembrar: boolean;
  onEscolher: (id: string | null) => void;
  onLembrar: (v: boolean) => void;
  onNovoLocal: (l: Local) => void | Promise<void>;
}) {
  const uid = useId();
  const [novo, setNovo] = useState(false);

  const cands = useMemo(() => candidatosLocais(texto, locais), [texto, locais]);
  const auto = cands[0]?.local ?? null;
  const escolhido = escolhidoId ? (locais.find((l) => l.id === escolhidoId) ?? null) : null;
  const atual = escolhido ?? auto;
  const ambiguo = !escolhido && ehAmbiguo(texto, locais);

  const restantes = useMemo(() => {
    const ids = new Set(cands.map((c) => c.local.id));
    return locais.filter((l) => !ids.has(l.id)).sort((a, b) => a.apelido.localeCompare(b.apelido, "pt-BR"));
  }, [cands, locais]);

  // só oferece "lembrar" quando a escolha não seria reconhecida sozinha pelo nome
  const podeLembrar =
    !!escolhido && !!normalizar(texto) && candidatosLocais(texto, [escolhido])[0]?.nivel !== "EXATO";

  const semLocal = !atual;
  const rotulo = papel === "origem" ? "Local de carregamento" : "Local de descarga";

  return (
    <div className={`picker ${semLocal || ambiguo ? "warn" : ""}`}>
      <label htmlFor={`${uid}-sel`}>
        {rotulo}
        {ambiguo && <span className="ai-tag">Mais de um parecido</span>}
        {semLocal && <span className="ai-tag">Não cadastrado</span>}
      </label>

      <select
        id={`${uid}-sel`}
        value={escolhido ? escolhido.id : ""}
        onChange={(e) => {
          if (e.target.value === NOVO) setNovo(true);
          else {
            setNovo(false);
            onEscolher(e.target.value || null);
          }
        }}
      >
        <option value="">{auto ? `Automático: ${rotuloLocal(auto)}` : "Automático: não encontrei"}</option>
        {cands.length > 0 && (
          <optgroup label="Parecidos com o nome">
            {cands.map((c) => (
              <option key={c.local.id} value={c.local.id}>
                {rotuloLocal(c.local)}
              </option>
            ))}
          </optgroup>
        )}
        {restantes.length > 0 && (
          <optgroup label={cands.length > 0 ? "Outros locais" : "Meus locais"}>
            {restantes.map((l) => (
              <option key={l.id} value={l.id}>
                {rotuloLocal(l)}
              </option>
            ))}
          </optgroup>
        )}
        <option value={NOVO}>+ Cadastrar novo local...</option>
      </select>

      {atual ? (
        <p className="picker-end">
          {atual.apelido}
          {atual.endereco ? ` · ${atual.endereco}` : ""}{" "}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${atual.lat},${atual.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver no mapa
          </a>
        </p>
      ) : (
        <p className="picker-end warn">
          Esse nome ainda não está nos seus locais. Escolha um da lista ou cadastre um novo.
        </p>
      )}

      {podeLembrar && (
        <label className="chk">
          <input type="checkbox" checked={lembrar} onChange={(e) => onLembrar(e.target.checked)} />
          <span>
            Lembrar: quando a mensagem disser “{texto.trim()}”, usar {escolhido?.apelido}
          </span>
        </label>
      )}

      {novo && (
        <div className="picker-novo">
          <LocalForm
            apelidoInicial={texto.trim()}
            rotulo="Salvar e usar este local"
            onSalvar={async (l) => {
              await onNovoLocal(l);
              onEscolher(l.id);
              setNovo(false);
            }}
          />
          <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setNovo(false)}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
