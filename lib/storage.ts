"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth.tsx";
import { createClient } from "./supabase/client.ts";
import type { CargaSalva, Local, Truck, Viagem } from "./types.ts";

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

const TRUCK_ATUALIZADO_KEY = "fretemax:truck-atualizado-em";

function dataSalva(chave: string): number {
  try {
    return Number(localStorage.getItem(chave) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function marcarAtualizado(chave: string, data = Date.now()) {
  try {
    localStorage.setItem(chave, String(data));
  } catch {
    /* continua local mesmo sem poder registrar o timestamp */
  }
}

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
  atualizado_em: string;
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
    atualizado_em: new Date().toISOString(),
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
      const remoto = data as CaminhaoRow | null;
      // Instalações antigas não têm timestamp local. Se o caminhão foi alterado
      // em relação ao padrão, damos preferência a ele no primeiro login para não
      // apagar uma configuração já feita no aparelho.
      const localMudou = dataSalva(TRUCK_ATUALIZADO_KEY) ||
        (JSON.stringify(truckRef.current) !== JSON.stringify(TRUCK_PADRAO) ? Date.now() : 0);
      const remotoMudou = remoto ? new Date(remoto.atualizado_em).getTime() : 0;
      if (!remoto || localMudou >= remotoMudou) {
        if (localMudou) marcarAtualizado(TRUCK_ATUALIZADO_KEY, localMudou);
        await supabase.from("caminhoes").upsert(linhaDoTruck(user.id, truckRef.current));
      } else {
        setTruckLocal(truckDaLinha(remoto));
        marcarAtualizado(TRUCK_ATUALIZADO_KEY, remotoMudou);
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
        marcarAtualizado(TRUCK_ATUALIZADO_KEY);
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
  atualizado_em: string;
};

function localDaLinha(r: LocalRow): Local {
  return { id: r.id, apelido: r.apelido, sinonimos: r.sinonimos ?? [], endereco: r.endereco, lat: r.lat, lng: r.lng, atualizadoEm: r.atualizado_em };
}

function linhaDoLocal(userId: string, l: Local): LocalRow {
  return { id: l.id, user_id: userId, apelido: l.apelido, sinonimos: l.sinonimos, endereco: l.endereco, lat: l.lat, lng: l.lng, atualizado_em: l.atualizadoEm ?? new Date().toISOString() };
}

function assinaturaLocal(l: Local): string {
  const { atualizadoEm: _atualizadoEm, ...dados } = l;
  return JSON.stringify(dados);
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
    const userId = user.id;
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("locais").select("*").eq("user_id", user.id);
      if (cancelado || error) return;
      const locaisNuvem = ((data ?? []) as LocalRow[]).map(localDaLinha);
      const remotos = new Map(locaisNuvem.map((l) => [l.id, l]));
      const mesclados = new Map(remotos);
      const paraSalvarNaEntrada: Local[] = [];
      for (const localOriginal of locaisRef.current) {
        const local = localOriginal.atualizadoEm ? localOriginal : { ...localOriginal, atualizadoEm: new Date().toISOString() };
        const remoto = remotos.get(local.id);
        const localEm = new Date(local.atualizadoEm!).getTime();
        const remotoEm = remoto?.atualizadoEm ? new Date(remoto.atualizadoEm).getTime() : 0;
        if (!remoto || localEm >= remotoEm) {
          mesclados.set(local.id, local);
          paraSalvarNaEntrada.push(local);
        }
      }
      const resultadoMesclado = [...mesclados.values()];
      setLocaisLocal(resultadoMesclado);
      if (paraSalvarNaEntrada.length > 0) {
        await supabase.from("locais").upsert(paraSalvarNaEntrada.map((l) => linhaDoLocal(userId, l)));
      }
      espelhoRef.current = new Map(resultadoMesclado.map((l) => [l.id, assinaturaLocal(l)]));
      return;

      const linhas = (data ?? []) as LocalRow[];
      if (linhas.length > 0) {
        const nuvem = linhas.map(localDaLinha);
        espelhoRef.current = new Map(nuvem.map((l) => [l.id, JSON.stringify(l)]));
        setLocaisLocal(nuvem);
      } else if (locaisRef.current.length > 0) {
        // primeira vez nesta conta: sobe os locais que já estavam cadastrados no aparelho
        await supabase.from("locais").insert(locaisRef.current.map((l) => linhaDoLocal(userId, l)));
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
        const recebido = typeof v === "function" ? (v as (p: Local[]) => Local[])(prev) : v;
        const agora = new Date().toISOString();
        const anterior = new Map(prev.map((l) => [l.id, l]));
        const novo = recebido.map((l) => {
          const antes = anterior.get(l.id);
          return !antes || assinaturaLocal(antes) !== assinaturaLocal(l) ? { ...l, atualizadoEm: agora } : l;
        });
        if (user && espelhoRef.current) {
          const espelho = espelhoRef.current;
          const idsNovos = new Set(novo.map((l) => l.id));
          const paraSalvar = novo.filter((l) => espelho.get(l.id) !== assinaturaLocal(l));
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
          espelhoRef.current = new Map(novo.map((l) => [l.id, assinaturaLocal(l)]));
        }
        return novo;
      });
    },
    [user, setLocaisLocal],
  );

  return [locais, setLocais, pronto] as const;
}

type CargaRow = {
  id: string;
  user_id: string;
  empresa: string | null;
  grupo: string | null;
  origem_texto: string;
  destino_texto: string;
  valor: number | null;
  unidade: string;
  pedagio: string;
  agendamento: string;
  carregamento_ate: string | null;
  descarga_ate: string | null;
  observacoes: string;
  contato: string | null;
  origem_local_id: string | null;
  destino_local_id: string | null;
  lucro_rs: number | null;
  lucro_por_hora_rs: number | null;
  km_vazio: number | null;
  km_cheio: number | null;
  km_retorno: number | null;
  km_total: number | null;
  horas: number | null;
  pct_vazio: number | null;
  status: string;
  viagem_id: string | null;
  analisada_em: string;
  mensagem_original: string | null;
};

function cargaDaLinha(r: CargaRow): CargaSalva {
  return {
    id: r.id,
    empresa: r.empresa,
    grupo: r.grupo,
    origemTexto: r.origem_texto,
    destinoTexto: r.destino_texto,
    valor: r.valor,
    unidade: r.unidade as CargaSalva["unidade"],
    pedagio: r.pedagio as CargaSalva["pedagio"],
    agendamento: r.agendamento as CargaSalva["agendamento"],
    carregamentoAte: r.carregamento_ate,
    descargaAte: r.descarga_ate,
    observacoes: r.observacoes,
    contato: r.contato,
    origemLocalId: r.origem_local_id,
    destinoLocalId: r.destino_local_id,
    lucroRS: r.lucro_rs,
    lucroPorHoraRS: r.lucro_por_hora_rs,
    kmVazio: r.km_vazio,
    kmCheio: r.km_cheio,
    kmRetorno: r.km_retorno,
    kmTotal: r.km_total,
    horas: r.horas,
    pctVazio: r.pct_vazio,
    status: r.status as CargaSalva["status"],
    viagemId: r.viagem_id,
    analisadaEm: r.analisada_em,
    mensagemOriginal: r.mensagem_original,
  };
}

function linhaDaCarga(userId: string, c: CargaSalva): CargaRow {
  return {
    id: c.id,
    user_id: userId,
    empresa: c.empresa,
    grupo: c.grupo,
    origem_texto: c.origemTexto,
    destino_texto: c.destinoTexto,
    valor: c.valor,
    unidade: c.unidade,
    pedagio: c.pedagio,
    agendamento: c.agendamento,
    carregamento_ate: c.carregamentoAte,
    descarga_ate: c.descargaAte,
    observacoes: c.observacoes,
    contato: c.contato,
    origem_local_id: c.origemLocalId,
    destino_local_id: c.destinoLocalId,
    lucro_rs: c.lucroRS,
    lucro_por_hora_rs: c.lucroPorHoraRS,
    km_vazio: c.kmVazio,
    km_cheio: c.kmCheio,
    km_retorno: c.kmRetorno,
    km_total: c.kmTotal,
    horas: c.horas,
    pct_vazio: c.pctVazio,
    status: c.status,
    viagem_id: c.viagemId,
    analisada_em: c.analisadaEm,
    mensagem_original: c.mensagemOriginal,
  };
}

/** Histórico de cargas analisadas (tela "Cargas"): local-first, com sincronização quando logado. */
export function useCargas() {
  const [cargas, setCargasLocal, pronto] = useLocalStorage<CargaSalva[]>("fretemax:cargas", []);
  const { user } = useAuth();
  const cargasRef = useRef(cargas);
  cargasRef.current = cargas;
  const espelhoRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!user || !pronto) return;
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cargas")
        .select("*")
        .eq("user_id", user.id)
        .order("analisada_em", { ascending: false });
      if (cancelado || error) return;
      const linhas = (data ?? []) as CargaRow[];
      if (linhas.length > 0) {
        const nuvem = linhas.map(cargaDaLinha);
        espelhoRef.current = new Map(nuvem.map((c) => [c.id, JSON.stringify(c)]));
        setCargasLocal(nuvem);
      } else if (cargasRef.current.length > 0) {
        await supabase.from("cargas").insert(cargasRef.current.map((c) => linhaDaCarga(user.id, c)));
        espelhoRef.current = new Map(cargasRef.current.map((c) => [c.id, JSON.stringify(c)]));
      } else {
        espelhoRef.current = new Map();
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, pronto]);

  const setCargas = useCallback(
    (v: CargaSalva[] | ((prev: CargaSalva[]) => CargaSalva[])) => {
      setCargasLocal((prev) => {
        const novo = typeof v === "function" ? (v as (p: CargaSalva[]) => CargaSalva[])(prev) : v;
        if (user && espelhoRef.current) {
          const espelho = espelhoRef.current;
          const idsNovos = new Set(novo.map((c) => c.id));
          const paraSalvar = novo.filter((c) => espelho.get(c.id) !== JSON.stringify(c));
          const paraApagar = [...espelho.keys()].filter((id) => !idsNovos.has(id));
          const supabase = createClient();
          if (paraSalvar.length > 0) {
            supabase
              .from("cargas")
              .upsert(paraSalvar.map((c) => linhaDaCarga(user.id, c)))
              .then(() => {});
          }
          if (paraApagar.length > 0) {
            supabase
              .from("cargas")
              .delete()
              .in("id", paraApagar)
              .then(() => {});
          }
          espelhoRef.current = new Map(novo.map((c) => [c.id, JSON.stringify(c)]));
        }
        return novo;
      });
    },
    [user, setCargasLocal],
  );

  return [cargas, setCargas, pronto] as const;
}
