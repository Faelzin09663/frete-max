"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LocalForm } from "@/components/LocalForm";
import { consumirCompartilhado } from "@/lib/compartilhado.ts";
import { NumInput } from "@/components/NumInput";
import { OfferCard, type Selo } from "@/components/OfferCard";
import { calcular, parseHora, valorEfetivo } from "@/lib/calc.ts";
import { extrairOfertas, getLeg } from "@/lib/client-api.ts";
import { acharLocal, normalizar } from "@/lib/match.ts";
import { montarMapa } from "@/lib/mapa.ts";
import { fmtNum } from "@/lib/format.ts";
import { useLocais, useTruck, novoId } from "@/lib/storage.ts";
import type { CalcResult, Leg, Local, MapaDados, Oferta } from "@/lib/types.ts";

type Mensagem = { id: string; texto: string; imagens: File[] };
type Linha = { oferta: Oferta; origem: Local | null; destino: Local | null; calc: CalcResult | null; mapa?: MapaDados };

const ZERO: Leg = { km: 0, min: 0, tollRS: 0, estimado: false };
const mensagemVazia = (): Mensagem => ({ id: novoId(), texto: "", imagens: [] });

function horaAgora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CargasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [truck, , truckPronto] = useTruck();
  const [locais, setLocais, locaisPronto] = useLocais();

  const [mensagens, setMensagens] = useState<Mensagem[]>([mensagemVazia()]);
  const [posicaoId, setPosicaoId] = useState("");
  const [agora, setAgora] = useState("");
  const [toneladas, setToneladas] = useState<number | null>(null);
  const [comRetorno, setComRetorno] = useState(false);
  const [ordem, setOrdem] = useState<"LUCRO" | "HORA">("HORA");

  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [lendo, setLendo] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setAgora(horaAgora()), []);

  function atualizarMensagem(patch: Partial<Mensagem>) {
    setMensagens((prev) => [{ ...prev[0], ...patch }]);
  }
  // usado pelo handoff do "Compartilhar": preenche o campo único
  function definirMensagemUnica(texto: string, imagens: File[]) {
    setMensagens((prev) => [{ ...prev[0], texto, imagens }]);
  }

  // conteúdo recebido pelo "Compartilhar" do WhatsApp (veja app/compartilhar)
  useEffect(() => {
    if (searchParams.get("compartilhado") === "1") {
      const dados = consumirCompartilhado();
      if (dados && (dados.texto || dados.imagens.length > 0)) {
        definirMensagemUnica(dados.texto, dados.imagens);
      }
      router.replace("/");
    } else if (searchParams.get("texto")) {
      definirMensagemUnica(searchParams.get("texto") ?? "", []);
      if (searchParams.get("semSw") === "1") {
        setErro("Recebi o texto, mas não a imagem. Se era um print, envie de novo por aqui.");
      }
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ton = toneladas ?? truck.capacidadeT;
  const base = comRetorno ? locais.find((l) => l.id === truck.baseLocalId) ?? null : null;

  const mensagensPreenchidas = mensagens.filter((m) => m.texto.trim() || m.imagens.length > 0);

  async function analisar() {
    setErro(null);
    setLendo(true);
    try {
      const resultados = await Promise.allSettled(mensagensPreenchidas.map((m) => extrairOfertas(m.texto, m.imagens)));
      const novas: Oferta[] = [];
      let falhas = 0;
      resultados.forEach((r) => {
        if (r.status === "fulfilled") {
          novas.push(...r.value);
        } else {
          falhas++;
        }
      });
      if (falhas > 0) {
        setErro(
          falhas === mensagensPreenchidas.length
            ? "Não consegui ler a mensagem."
            : `Não consegui ler ${falhas} parte(s) da mensagem. As outras foram analisadas.`,
        );
      } else if (novas.length === 0) {
        setErro("Não encontrei nenhuma carga nessas mensagens.");
      }
      setOfertas(novas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ler as mensagens.");
    } finally {
      setLendo(false);
    }
  }

  // Recalcula tudo sempre que ofertas, locais ou configurações mudam. Rotas ficam em cache.
  useEffect(() => {
    if (!truckPronto || !locaisPronto) return;
    let cancelado = false;
    (async () => {
      setCalculando(true);
      const pos = locais.find((l) => l.id === posicaoId) ?? null;
      const agoraMin = parseHora(agora);
      const out: Linha[] = [];
      for (const oferta of ofertas) {
        const origem = acharLocal(oferta.origemTexto, locais);
        const destino = acharLocal(oferta.destinoTexto, locais);
        if (!origem || !destino) {
          out.push({ oferta, origem, destino, calc: null });
          continue;
        }
        try {
          const [vazio, cheio, retorno] = await Promise.all([
            pos ? getLeg(pos, origem) : Promise.resolve(ZERO),
            getLeg(origem, destino),
            base ? getLeg(destino, base) : Promise.resolve(null),
          ]);
          out.push({
            oferta,
            origem,
            destino,
            calc: calcular({ oferta, truck, toneladas: ton, vazio, cheio, retorno, agoraMin: pos ? agoraMin : null }),
            mapa: montarMapa(pos, origem, destino, base, vazio, cheio, retorno),
          });
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Erro ao calcular rotas.");
          out.push({ oferta, origem, destino, calc: null });
        }
      }
      if (!cancelado) {
        setLinhas(out);
        setCalculando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofertas, locais, truck, posicaoId, agora, ton, base?.id, truckPronto, locaisPronto]);

  function editar(id: string, patch: Partial<Oferta>) {
    setOfertas((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  // Locais que a IA citou e ainda não estão cadastrados (sem repetir)
  const faltando = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const l of linhas) {
      if (!l.origem) vistos.set(normalizar(l.oferta.origemTexto), l.oferta.origemTexto);
      if (!l.destino) vistos.set(normalizar(l.oferta.destinoTexto), l.oferta.destinoTexto);
    }
    return [...vistos.values()].filter(Boolean);
  }, [linhas]);

  const calculadas = useMemo(() => {
    const ok = linhas.filter((l): l is Linha & { calc: CalcResult } => !!l.calc && valorEfetivo(l.oferta) != null);
    const semValor = linhas.filter((l): l is Linha & { calc: CalcResult } => !!l.calc && valorEfetivo(l.oferta) == null);
    const chave = (l: { calc: CalcResult }) => (ordem === "HORA" ? l.calc.lucroPorHoraRS : l.calc.lucroRS);
    ok.sort((a, b) => {
      const ia = a.calc.viabilidade === "INVIAVEL" ? 1 : 0;
      const ib = b.calc.viabilidade === "INVIAVEL" ? 1 : 0;
      return ia - ib || chave(b) - chave(a);
    });
    const viaveis = ok.filter((l) => l.calc.viabilidade !== "INVIAVEL");
    const melhorLucro = viaveis.length > 1 ? [...viaveis].sort((a, b) => b.calc.lucroRS - a.calc.lucroRS)[0] : null;
    const melhorHora = viaveis.length > 1 ? [...viaveis].sort((a, b) => b.calc.lucroPorHoraRS - a.calc.lucroPorHoraRS)[0] : null;
    return { ok, semValor, melhorLucro, melhorHora };
  }, [linhas, ordem]);

  const seloDe = (id: string): Selo[] => {
    const s: Selo[] = [];
    if (calculadas.melhorLucro?.oferta.id === id) s.push("LUCRO");
    if (calculadas.melhorHora?.oferta.id === id) s.push("HORA");
    return s;
  };

  const semLocais = locaisPronto && locais.length === 0;

  return (
    <>
      <h1>Qual carga vale mais?</h1>
      <p className="lead">Cole uma ou várias ofertas na mesma mensagem, ou envie os prints. Eu separo cada carga, calculo o lucro e comparo qual rota vale mais.</p>

      {semLocais && (
        <div className="note">
          Comece cadastrando seus locais. <Link href="/locais">Ir para Locais</Link>
        </div>
      )}

      <div className="panel">
        <label htmlFor={`msg-${mensagens[0].id}`}>Mensagem com uma ou várias cargas</label>
        <textarea
          id={`msg-${mensagens[0].id}`}
          value={mensagens[0].texto}
          onChange={(e) => atualizarMensagem({ texto: e.target.value })}
          placeholder="Cole aqui todas as mensagens/ofertas do WhatsApp. A IA vai separar cada origem e destino automaticamente."
        />
        <label htmlFor={`img-${mensagens[0].id}`}>Ou envie os prints da conversa</label>
        <input
          id={`img-${mensagens[0].id}`}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => atualizarMensagem({ imagens: Array.from(e.target.files ?? []) })}
        />
        {mensagens[0].imagens.length > 0 && <div className="hint">{mensagens[0].imagens.length} imagem(ns) selecionada(s)</div>}
        <p className="hint">
          Pode colar várias divulgações seguidas, mesmo que cada uma tenha origem, destino e preço diferentes. Eu separo tudo e mostro uma análise por rota.
        </p>

        <label htmlFor="pos">Onde você está agora</label>
        <select id="pos" value={posicaoId} onChange={(e) => setPosicaoId(e.target.value)}>
          <option value="">Já estou na origem (sem km vazio)</option>
          {locais.map((l) => (
            <option key={l.id} value={l.id}>
              {l.apelido}
            </option>
          ))}
        </select>

        <div className="row2">
          <div>
            <label htmlFor="hora">Hora agora</label>
            <input id="hora" type="time" value={agora} onChange={(e) => setAgora(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ton">Toneladas</label>
            <NumInput id="ton" value={ton} onChange={setToneladas} />
          </div>
        </div>

        {truck.baseLocalId && (
          <label className="check">
            <input type="checkbox" checked={comRetorno} onChange={(e) => setComRetorno(e.target.checked)} />
            Contar a volta vazia até a base
          </label>
        )}

        {erro && <div className="error">{erro}</div>}
        <div className="actions">
          <button onClick={analisar} disabled={lendo || mensagensPreenchidas.length === 0}>
            {lendo ? "Separando e analisando as cargas..." : "Analisar cargas"}
          </button>
        </div>
      </div>

      {faltando.length > 0 && (
        <>
          <h2>Locais novos</h2>
          <p className="lead">Preciso do endereço de {faltando.length === 1 ? "um local" : "alguns locais"} para calcular. É só uma vez.</p>
          {faltando.map((nome) => (
            <div className="panel attn" key={nome}>
              <LocalForm
                apelidoInicial={nome}
                onSalvar={(l) => setLocais((prev) => [...prev, l])}
                rotulo={`Salvar ${nome}`}
              />
            </div>
          ))}
        </>
      )}

      {calculando && <div className="spin">Calculando rotas...</div>}

      {calculadas.ok.length > 0 && (
        <>
          <h2>Resultado</h2>
          <div className="row2" style={{ marginBottom: 12 }}>
            <button className={ordem === "HORA" ? "" : "sec"} onClick={() => setOrdem("HORA")}>
              Por hora
            </button>
            <button className={ordem === "LUCRO" ? "" : "sec"} onClick={() => setOrdem("LUCRO")}>
              Por lucro
            </button>
          </div>
          {calculadas.ok.map((l) => (
            <OfferCard
              key={l.oferta.id}
              oferta={l.oferta}
              origemNome={l.origem!.apelido}
              destinoNome={l.destino!.apelido}
              calc={l.calc}
              mapa={l.mapa ?? null}
              selos={seloDe(l.oferta.id)}
              onEditar={(p) => editar(l.oferta.id, p)}
            />
          ))}
        </>
      )}

      {calculadas.semValor.length > 0 && (
        <>
          <h2>Sem preço na mensagem</h2>
          <p className="lead">Digite o frete para ver o lucro. Toneladas: {fmtNum(ton)}.</p>
          {calculadas.semValor.map((l) => (
            <OfferCard
              key={l.oferta.id}
              oferta={l.oferta}
              origemNome={l.origem!.apelido}
              destinoNome={l.destino!.apelido}
              calc={l.calc}
              mapa={l.mapa ?? null}
              selos={[]}
              onEditar={(p) => editar(l.oferta.id, p)}
            />
          ))}
        </>
      )}
    </>
  );
}
