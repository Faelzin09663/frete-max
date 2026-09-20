"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Local, Oferta } from "./types.ts";

export type Mensagem = { id: string; texto: string; imagens: File[] };
export type Fase = "INPUT" | "REVISAO" | "RESULTADO";
export type Ordenacao = "LUCRO" | "HORA";

const mensagemVazia = (id = "principal"): Mensagem => ({ id, texto: "", imagens: [] });

type AnaliseValue = {
  mensagens: Mensagem[];
  setMensagens: (v: Mensagem[] | ((prev: Mensagem[]) => Mensagem[])) => void;
  posicaoId: string;
  setPosicaoId: (v: string) => void;
  /** Posição capturada por GPS (quando posicaoId === GPS_ATUAL_ID); não fica em "Locais". */
  localGps: Local | null;
  setLocalGps: (v: Local | null) => void;
  agora: string;
  setAgora: (v: string) => void;
  toneladas: number | null;
  setToneladas: (v: number | null) => void;
  comRetorno: boolean;
  setComRetorno: (v: boolean) => void;
  ordem: Ordenacao;
  setOrdem: (v: Ordenacao) => void;
  maxParadas: number;
  setMaxParadas: (v: number) => void;
  prazoVoltaH: number | null;
  setPrazoVoltaH: (v: number | null) => void;
  fase: Fase;
  setFase: (v: Fase) => void;
  ofertasBrutas: Oferta[];
  setOfertasBrutas: (v: Oferta[]) => void;
  ofertas: Oferta[];
  setOfertas: (v: Oferta[] | ((prev: Oferta[]) => Oferta[])) => void;
  /** Reseta tudo: mensagem, ofertas e fase. Usado pelo botão "Nova análise". */
  reiniciar: () => void;
};

const AnaliseContext = createContext<AnaliseValue | null>(null);

/**
 * Fica no layout raiz (fora das páginas), então sobrevive à navegação entre
 * Cargas, Caminhão, Locais etc. Sair da tela de Cargas para ajustar o
 * caminhão e voltar não apaga mais a mensagem colada nem o resultado já lido.
 */
export function AnaliseProvider({ children }: { children: ReactNode }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([mensagemVazia()]);
  const [posicaoId, setPosicaoId] = useState("");
  const [localGps, setLocalGps] = useState<Local | null>(null);
  const [agora, setAgora] = useState("");
  const [toneladas, setToneladas] = useState<number | null>(null);
  const [comRetorno, setComRetorno] = useState(false);
  const [ordem, setOrdem] = useState<Ordenacao>("HORA");
  const [maxParadas, setMaxParadas] = useState(4);
  const [prazoVoltaH, setPrazoVoltaH] = useState<number | null>(null);
  const [fase, setFase] = useState<Fase>("INPUT");
  const [ofertasBrutas, setOfertasBrutas] = useState<Oferta[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);

  const reiniciar = useCallback(() => {
    setMensagens([mensagemVazia()]);
    setFase("INPUT");
    setOfertasBrutas([]);
    setOfertas([]);
  }, []);

  const value = useMemo<AnaliseValue>(
    () => ({
      mensagens,
      setMensagens,
      posicaoId,
      setPosicaoId,
      localGps,
      setLocalGps,
      agora,
      setAgora,
      toneladas,
      setToneladas,
      comRetorno,
      setComRetorno,
      ordem,
      setOrdem,
      maxParadas,
      setMaxParadas,
      prazoVoltaH,
      setPrazoVoltaH,
      fase,
      setFase,
      ofertasBrutas,
      setOfertasBrutas,
      ofertas,
      setOfertas,
      reiniciar,
    }),
    [mensagens, posicaoId, localGps, agora, toneladas, comRetorno, ordem, maxParadas, prazoVoltaH, fase, ofertasBrutas, ofertas, reiniciar],
  );

  return <AnaliseContext.Provider value={value}>{children}</AnaliseContext.Provider>;
}

export function useAnalise(): AnaliseValue {
  const ctx = useContext(AnaliseContext);
  if (!ctx) throw new Error("useAnalise precisa estar dentro de <AnaliseProvider> (veja app/layout.tsx).");
  return ctx;
}
