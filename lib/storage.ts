"use client";
import { useCallback, useEffect, useState } from "react";
import type { Local, Truck } from "./types.ts";

export const TRUCK_PADRAO: Truck = {
  nome: "Meu caminhão",
  capacidadeT: 30,
  eixos: 6,
  consumoCheioKmL: 2.0,
  consumoVazioKmL: 2.8,
  dieselRSL: 6.2,
  custoKmRS: 1.2,
  fatorTempo: 1.3,
  tempoCargaH: 1,
  tempoDescargaH: 1,
  baseLocalId: null,
};

/** Estado persistido no navegador. Retorna `pronto=false` até ler o localStorage. */
export function useLocalStorage<T>(key: string, inicial: T) {
  const [valor, setValor] = useState<T>(inicial);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const salvo = JSON.parse(raw);
        // objetos são mesclados com os padrões (campos novos ganham valor inicial); listas entram como estão
        setValor(Array.isArray(salvo) ? (salvo as T) : ({ ...inicial, ...salvo } as T));
      }
    } catch {
      /* ignora dado corrompido */
    }
    setPronto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const salvar = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValor((prev) => {
        const novo = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(key, JSON.stringify(novo));
        } catch {
          /* cheio ou bloqueado */
        }
        return novo;
      });
    },
    [key],
  );

  return [valor, salvar, pronto] as const;
}

export const useTruck = () => useLocalStorage<Truck>("fretemax:truck", TRUCK_PADRAO);
export const useLocais = () => useLocalStorage<Local[]>("fretemax:locais", []);

export function novoId(): string {
  return Math.random().toString(36).slice(2, 10);
}
