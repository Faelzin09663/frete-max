"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth.tsx";
import { createClient } from "./supabase/client.ts";
import type { Local, Truck, Viagem } from "./types.ts";

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

export function novoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Viagens concluídas/escolhidas: ficam no aparelho para o painel semanal. */
export function useViagens() {
  return useLocalStorage<Viagem[]>("fretemax:viagens", []);
}

// ---------------------------------------------------------------------------
// Sincronização opcional com o Supabase. Sem login, tudo se comporta igual ao
// MVP (só localStorage). Ao entrar, cada tela continua usando useTruck()/
// useLocais() do mesmo jeito: a nuvem entra por trás, sem mudar as páginas.
// ---------------------------------------------------------------------------

type CaminhaoRow = {
  user_id: string;
  nome: string;
  capacidade_t: number;
  eixos: number;
  consumo_cheio_kml: number;
  consumo_vazio_kml: number;
  diesel_rsl: number;
  custo_km_rs: number;
  fator_tempo: number;
  tempo_carga_h: number;
  tempo_descarga_h: number;
  base_local_id: string | null;
};

function truckDaLinha(r: CaminhaoRow): Truck {
  return {
    nome: r.nome,
    capacidadeT: r.capacidade_t,
    eixos: r.eixos,
    consumoCheioKmL: r.consumo_cheio_kml,
    consumoVazioKmL: r.consumo_vazio_kml,
    dieselRSL: r.diesel_rsl,
    custoKmRS: r.custo_km_rs,
    fatorTempo: r.fator_tempo,
    tempoCargaH: r.tempo_carga_h,
    tempoDescargaH: r.tempo_descarga_h,
    baseLocalId: r.base_local_id,
  };
}

function linhaDoTruck(userId: string, t: Truck): CaminhaoRow {
  return {
    user_id: userId,
    nome: t.nome,
    capacidade_t: t.capacidadeT,
    eixos: t.eixos,
    consumo_cheio_kml: t.consumoCheioKmL,
    consumo_vazio_kml: t.consumoVazioKmL,
    diesel_rsl: t.dieselRSL,
    custo_km_rs: t.custoKmRS,
    fator_tempo: t.fatorTempo,
    tempo_carga_h: t.tempoCargaH,
    tempo_descarga_h: t.tempoDescargaH,
    base_local_id: t.baseLocalId,
  };
}

/** Caminhão: local-first, com sincronização em segundo plano quando logado. */
export function useTruck() {
  const [truck, setTruckLocal, pronto] = useLocalStorage<Truck>("fretemax:truck", TRUCK_PADRAO);
  const { user } = useAuth();
  const truckRef = useRef(truck);
  truckRef.current = truck;

  // ao entrar: busca o caminhão da nuvem; se ainda não existir lá, sobe o que está no aparelho
  useEffect(() => {
    if (!user || !pronto) return;
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("caminhoes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelado || error) return;
      if (data) {
        setTruckLocal(truckDaLinha(data as CaminhaoRow));
      } else {
        await supabase.from("caminhoes").upsert(linhaDoTruck(user.id, truckRef.current));
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, pronto]);

  const setTruck = useCallback(
    (v: Truck | ((prev: Truck) => Truck)) => {
      setTruckLocal((prev) => {
        const novo = typeof v === "function" ? (v as (p: Truck) => Truck)(prev) : v;
        if (user) {
          const supabase = createClient();
          supabase
            .from("caminhoes")
            .upsert(linhaDoTruck(user.id, novo))
            .then(() => {});
        }
        return novo;
      });
    },
    [user, setTruckLocal],
  );

  return [truck, setTruck, pronto] as const;
}

type LocalRow = {
  id: string;
  user_id: string;
  apelido: string;
  sinonimos: string[];
  endereco: string;
  lat: number;
  lng: number;
};

function localDaLinha(r: LocalRow): Local {
  return { id: r.id, apelido: r.apelido, sinonimos: r.sinonimos ?? [], endereco: r.endereco, lat: r.lat, lng: r.lng };
}

function linhaDoLocal(userId: string, l: Local): LocalRow {
  return { id: l.id, user_id: userId, apelido: l.apelido, sinonimos: l.sinonimos, endereco: l.endereco, lat: l.lat, lng: l.lng };
}

/** Locais: local-first, com sincronização em segundo plano quando logado. */
export function useLocais() {
  const [locais, setLocaisLocal, pronto] = useLocalStorage<Local[]>("fretemax:locais", []);
  const { user } = useAuth();
  const locaisRef = useRef(locais);
  locaisRef.current = locais;
  // guarda o último estado já refletido na nuvem, para saber o que mudou a cada `setLocais`
  const espelhoRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!user || !pronto) return;
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("locais").select("*").eq("user_id", user.id);
      if (cancelado || error) return;
      const linhas = (data ?? []) as LocalRow[];
      if (linhas.length > 0) {
        const nuvem = linhas.map(localDaLinha);
        espelhoRef.current = new Map(nuvem.map((l) => [l.id, JSON.stringify(l)]));
        setLocaisLocal(nuvem);
      } else if (locaisRef.current.length > 0) {
        // primeira vez nesta conta: sobe os locais que já estavam cadastrados no aparelho
        await supabase.from("locais").insert(locaisRef.current.map((l) => linhaDoLocal(user.id, l)));
        espelhoRef.current = new Map(locaisRef.current.map((l) => [l.id, JSON.stringify(l)]));
      } else {
        espelhoRef.current = new Map();
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, pronto]);

  const setLocais = useCallback(
    (v: Local[] | ((prev: Local[]) => Local[])) => {
      setLocaisLocal((prev) => {
        const novo = typeof v === "function" ? (v as (p: Local[]) => Local[])(prev) : v;
        if (user && espelhoRef.current) {
          const espelho = espelhoRef.current;
          const idsNovos = new Set(novo.map((l) => l.id));
          const paraSalvar = novo.filter((l) => espelho.get(l.id) !== JSON.stringify(l));
          const paraApagar = [...espelho.keys()].filter((id) => !idsNovos.has(id));
          const supabase = createClient();
          if (paraSalvar.length > 0) {
            supabase
              .from("locais")
              .upsert(paraSalvar.map((l) => linhaDoLocal(user.id, l)))
              .then(() => {});
          }
          if (paraApagar.length > 0) {
            supabase
              .from("locais")
              .delete()
              .in("id", paraApagar)
              .then(() => {});
          }
          espelhoRef.current = new Map(novo.map((l) => [l.id, JSON.stringify(l)]));
        }
        return novo;
      });
    },
    [user, setLocaisLocal],
  );

  return [locais, setLocais, pronto] as const;
}
