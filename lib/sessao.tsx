"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Oferta } from "./types.ts";

/**
 * Sessão de análise: tudo o que o motorista já fez na tela de Cargas.
 *
 * Antes, isso ficava em useState da própria página, então sair para "Caminhão" ou "Locais"
 * (ou recarregar) apagava tudo e obrigava a analisar de novo (gastando IA e rotas).
 * Agora vive num provider no layout (sobrevive à troca de tela) e é salvo no aparelho
 * (sobrevive a recarregar/fechar o app). Os prints em si não são salvos (arquivos grandes),
 * mas as ofertas lidas a partir deles sim.
 */

export type Mensagem = { id: string; texto: string; imagens: File[] };
export type Fase = "INPUT" | "REVISAO" | "RESULTADO";
export type ConfigPlano = { ativo: boolean; maxCargas: number; voltar: boolean };

export type Sessao = {
  mensagens: Mensagem[];
  posicaoId: string;
  agora: string; // não é salvo: a cada abertura volta a ser a hora atual
  agoraManual: boolean;
  toneladas: number | null;
  comRetorno: boolean;
  ordem: "LUCRO" | "HORA";
  fase: Fase;
  ofertasBrutas: Oferta[];
  ofertas: Oferta[];
  plano: ConfigPlano;
};

const mensagemVazia = (): Mensagem => ({ id: "principal", texto: "", imagens: [] });

const INICIAL: Sessao = {
  mensagens: [mensagemVazia()],
  posicaoId: "",
  agora: "",
  agoraManual: false,
  toneladas: null,
  comRetorno: false,
  ordem: "HORA",
  fase: "INPUT",
  ofertasBrutas: [],
  ofertas: [],
  plano: { ativo: false, maxCargas: 3, voltar: true },
};

const CHAVE = "fretemax:sessao";
const VERSAO = 1;
const VALIDADE_MS = 24 * 3600 * 1000; // análise de ontem não serve mais: cargas mudam

type SetCampo = <K extends keyof Sessao>(k: K, v: Sessao[K] | ((p: Sessao[K]) => Sessao[K])) => void;
type Ctx = { s: Sessao; set: SetCampo; pronto: boolean };
const SessaoCtx = createContext<Ctx | null>(null);

function paraDisco(s: Sessao) {
  return {
    mensagens: s.mensagens.map((m) => ({ id: m.id, texto: m.texto })),
    posicaoId: s.posicaoId,
    toneladas: s.toneladas,
    comRetorno: s.comRetorno,
    ordem: s.ordem,
    fase: s.fase,
    ofertasBrutas: s.ofertasBrutas,
    ofertas: s.ofertas,
    plano: s.plano,
  };
}

function estaVazia(s: Sessao): boolean {
  return s.fase === "INPUT" && s.ofertas.length === 0 && s.mensagens.every((m) => !m.texto.trim());
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Sessao>(INICIAL);
  const [pronto, setPronto] = useState(false);
  const ultima = useRef(s);
  ultima.current = s;

  // lê o que estava salvo (uma vez, ao abrir o app)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (raw) {
        const j = JSON.parse(raw);
        if (j?.v === VERSAO && Date.now() - j.salvoEm < VALIDADE_MS && j.dados) {
          const d = j.dados;
          setS((prev) => ({
            ...prev,
            ...d,
            mensagens:
              Array.isArray(d.mensagens) && d.mensagens.length > 0
                ? d.mensagens.map((m: { id: string; texto: string }) => ({ id: m.id, texto: m.texto, imagens: [] }))
                : prev.mensagens,
            plano: { ...prev.plano, ...(d.plano ?? {}) },
          }));
        }
      }
    } catch {
      /* salvo corrompido: começa do zero */
    }
    setPronto(true);
  }, []);

  const gravar = useCallback(() => {
    try {
      if (estaVazia(ultima.current)) localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, JSON.stringify({ v: VERSAO, salvoEm: Date.now(), dados: paraDisco(ultima.current) }));
    } catch {
      /* sem espaço/bloqueado: a sessão continua valendo em memória */
    }
  }, []);

  // grava pouco depois de cada mudança, e na hora se o app for para segundo plano
  useEffect(() => {
    if (!pronto) return;
    const id = setTimeout(gravar, 400);
    return () => clearTimeout(id);
  }, [s, pronto, gravar]);

  useEffect(() => {
    const aoSair = () => {
      if (document.visibilityState === "hidden") gravar();
    };
    document.addEventListener("visibilitychange", aoSair);
    window.addEventListener("pagehide", gravar);
    return () => {
      document.removeEventListener("visibilitychange", aoSair);
      window.removeEventListener("pagehide", gravar);
    };
  }, [gravar]);

  const set = useCallback<SetCampo>((k, v) => {
    setS((prev) => {
      const novo = typeof v === "function" ? (v as (p: Sessao[typeof k]) => Sessao[typeof k])(prev[k]) : v;
      return Object.is(prev[k], novo) ? prev : { ...prev, [k]: novo };
    });
  }, []);

  const valor = useMemo(() => ({ s, set, pronto }), [s, set, pronto]);
  return <SessaoCtx.Provider value={valor}>{children}</SessaoCtx.Provider>;
}

function useCtx(): Ctx {
  const c = useContext(SessaoCtx);
  if (!c) throw new Error("useSessao precisa estar dentro de <SessaoProvider>.");
  return c;
}

/** Mesmo formato do useState, mas o valor vive na sessão (sobrevive à troca de tela e ao recarregar). */
export function useCampoSessao<K extends keyof Sessao>(k: K) {
  const { s, set } = useCtx();
  const setter = useCallback((v: Sessao[K] | ((p: Sessao[K]) => Sessao[K])) => set(k, v), [set, k]);
  return [s[k], setter] as const;
}

/** true quando o que estava salvo já foi lido (antes disso a tela deve esperar). */
export function usePronto(): boolean {
  return useCtx().pronto;
}
