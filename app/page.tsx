"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icons";
import { LocalForm } from "@/components/LocalForm";
import { consumirCompartilhado } from "@/lib/compartilhado.ts";
import { NumInput } from "@/components/NumInput";
import { OfferCard, type Selo } from "@/components/OfferCard";
import { ReviewScreen } from "@/components/ReviewScreen";
import { ComparePanel } from "@/components/ComparePanel";
import { PlanoPanel } from "@/components/PlanoPanel";
import { Note, PageHead, Segmented } from "@/components/ui";
import { calcular, parseHora, valorEfetivo } from "@/lib/calc.ts";
import { extrairOfertasComInfo, getLeg } from "@/lib/client-api.ts";
import { acharLocal, normalizar } from "@/lib/match.ts";
import { montarMapa } from "@/lib/mapa.ts";
import { fmtNum } from "@/lib/format.ts";
import { viagensDoPlano, type Carga, type Plano } from "@/lib/plano.ts";
import { useCampoSessao, usePronto, type Mensagem } from "@/lib/sessao";
import { useLocais, useTruck, useViagens, novoId } from "@/lib/storage.ts";
import type { CalcResult, Leg, Local, MapaDados, Oferta, Viagem } from "@/lib/types.ts";

type Linha = { oferta: Oferta; origem: Local | null; destino: Local | null; calc: CalcResult | null; mapa?: MapaDados };

const ZERO: Leg = { km: 0, min: 0, tollRS: 0, estimado: false };

function horaAgora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Miniaturas dos prints anexados, com botão para remover cada um. */
function Miniaturas({ arquivos, onRemover }: { arquivos: File[]; onRemover: (i: number) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const novas = arquivos.map((f) => URL.createObjectURL(f));
    setUrls(novas);
    return () => novas.forEach((u) => URL.revokeObjectURL(u));
  }, [arquivos]);
  if (arquivos.length === 0) return null;
  return (
    <div className="thumbs" aria-label="Prints anexados">
      {urls.map((u, i) => (
        <div className="thumb" key={u}>
          <img src={u} alt={`Print ${i + 1}`} />
          <button type="button" onClick={() => onRemover(i)} aria-label={`Remover print ${i + 1}`}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function CargasPage() {
  return (
    <Suspense fallback={<div className="skel" />}>
      <CargasConteudo />
    </Suspense>
  );
}

function CargasConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [truck, , truckPronto] = useTruck();
  const [locais, setLocais, locaisPronto] = useLocais();
  const [, setViagens] = useViagens();

  // Tudo abaixo vive na sessão (lib/sessao.tsx): sobrevive à troca de tela e ao recarregar,
  // então sair para "Caminhão" e voltar não apaga a análise nem gasta IA/rotas de novo.
  const sessaoPronta = usePronto();
  const [mensagens, setMensagens] = useCampoSessao("mensagens");
  const [posicaoId, setPosicaoId] = useCampoSessao("posicaoId");
  const [agora, setAgora] = useCampoSessao("agora");
  const [agoraManual, setAgoraManual] = useCampoSessao("agoraManual");
  const [toneladas, setToneladas] = useCampoSessao("toneladas");
  const [comRetorno, setComRetorno] = useCampoSessao("comRetorno");
  const [ordem, setOrdem] = useCampoSessao("ordem");
  const [, setPlanoCfg] = useCampoSessao("plano");

  const [fase, setFase] = useCampoSessao("fase");
  const [ofertasBrutas, setOfertasBrutas] = useCampoSessao("ofertasBrutas"); // como veio da IA
  const [ofertas, setOfertas] = useCampoSessao("ofertas"); // confirmadas na revisão
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [infoIA, setInfoIA] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!agoraManual) setAgora(horaAgora());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoPronta]);

  function atualizarMensagem(patch: Partial<Mensagem>) {
    setMensagens((prev) => [{ ...prev[0], ...patch }]);
  }
  async function colar() {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto.trim()) atualizarMensagem({ texto: mensagens[0].texto ? `${mensagens[0].texto}\n\n${texto}` : texto });
    } catch {
      setErro("O navegador não deixou acessar a área de transferência. Toque no campo e cole manualmente.");
    }
  }
  function anexar(files: FileList | null) {
    const novas = Array.from(files ?? []);
    if (novas.length) atualizarMensagem({ imagens: [...mensagens[0].imagens, ...novas] });
  }
  // usado pelo handoff do "Compartilhar": preenche o campo único
  function definirMensagemUnica(texto: string, imagens: File[]) {
    setMensagens((prev) => [{ ...prev[0], texto, imagens }]);
    // mensagem nova = análise nova (não mistura com o resultado de antes)
    setFase("INPUT");
    setOfertasBrutas([]);
    setOfertas([]);
    setLinhas([]);
    setInfoIA(null);
    setPlanoCfg((p) => ({ ...p, ativo: false }));
  }

  // conteúdo recebido pelo "Compartilhar" do WhatsApp (veja app/compartilhar)
  useEffect(() => {
    if (!sessaoPronta) return;
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
  }, [sessaoPronta]);

  const ton = toneladas ?? truck.capacidadeT;
  const base = comRetorno ? locais.find((l) => l.id === truck.baseLocalId) ?? null : null;

  const mensagensPreenchidas = mensagens.filter((m) => m.texto.trim() || m.imagens.length > 0);

  async function analisar() {
    setErro(null);
    setLendo(true);
    try {
      const resultados = await Promise.allSettled(mensagensPreenchidas.map((m) => extrairOfertasComInfo(m.texto, m.imagens)));
      const novas: Oferta[] = [];
      let falhas = 0;
      let doCache = 0;
      resultados.forEach((r) => {
        if (r.status === "fulfilled") {
          novas.push(...r.value.ofertas);
          if (r.value.doCache) doCache++;
        } else {
          falhas++;
        }
      });
      setInfoIA(
        doCache > 0 && doCache === resultados.length - falhas
          ? "Essa mensagem já tinha sido lida: reaproveitei a resposta guardada, sem gastar IA."
          : null,
      );
      if (falhas > 0) {
        setErro(
          falhas === mensagensPreenchidas.length
            ? "Não consegui ler a mensagem."
            : `Não consegui ler ${falhas} parte(s) da mensagem. As outras foram analisadas.`,
        );
      } else if (novas.length === 0) {
        setErro("Não encontrei nenhuma carga nessas mensagens.");
      }
      if (novas.length > 0) {
        setOfertasBrutas(novas);
        setFase("REVISAO");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ler as mensagens.");
    } finally {
      setLendo(false);
    }
  }

  function confirmarRevisao(corrigidas: Oferta[]) {
    setOfertas(corrigidas);
    setFase("RESULTADO");
  }

  function voltarParaInput() {
    setFase("INPUT");
    setOfertasBrutas([]);
    setOfertas([]);
    setLinhas([]);
    setInfoIA(null);
    setPlanoCfg((p) => ({ ...p, ativo: false }));
  }

  // Recalcula tudo sempre que ofertas, locais ou configurações mudam. Rotas ficam em cache.
  useEffect(() => {
    if (!sessaoPronta || !truckPronto || !locaisPronto || fase !== "RESULTADO") return;
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
  }, [ofertas, locais, truck, posicaoId, agora, ton, base?.id, truckPronto, locaisPronto, sessaoPronta, fase]);

  function editar(id: string, patch: Partial<Oferta>) {
    setOfertas((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function escolherCarga(linha: Linha & { calc: CalcResult }) {
    const viagem: Viagem = {
      id: novoId(),
      realizadaEm: new Date().toISOString(),
      status: "ESCOLHIDA",
      origem: linha.origem?.apelido ?? linha.oferta.origemTexto,
      destino: linha.destino?.apelido ?? linha.oferta.destinoTexto,
      receitaRS: linha.calc.receitaRS,
      dieselRS: linha.calc.dieselRS,
      manutencaoRS: linha.calc.manutencaoRS,
      pedagioRS: linha.calc.pedagioRS,
      custoTotalRS: linha.calc.custoTotalRS,
      lucroRS: linha.calc.lucroRS,
      lucroPorHoraRS: linha.calc.lucroPorHoraRS,
      horas: linha.calc.horas,
      kmTotal: linha.calc.kmTotal,
      toneladas: ton,
    };
    setViagens((prev) => [viagem, ...prev]);
    router.push("/viagens");
  }

  function escolherPlano(p: Plano) {
    const planoId = novoId();
    const quando = new Date().toISOString();
    const novas: Viagem[] = viagensDoPlano(p, ton, truck).map((v) => ({
      id: novoId(),
      realizadaEm: quando,
      status: "ESCOLHIDA",
      planoId,
      ...v,
    }));
    setViagens((prev) => [...novas, ...prev]);
    router.push("/viagens");
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

  const temResultado = calculadas.ok.length > 0 || calculadas.semValor.length > 0;
  const m0 = mensagens[0];

  // Compare panel data
  const compareLinhas = useMemo(() => {
    return calculadas.ok
      .filter((l) => l.calc.viabilidade !== "INVIAVEL" && l.origem && l.destino)
      .map((l) => ({
        oferta: l.oferta,
        origemNome: l.origem!.apelido,
        destinoNome: l.destino!.apelido,
        calc: l.calc,
      }));
  }, [calculadas.ok]);

  // Sequência (casa → carga → carga → casa): só entram cargas com preço e locais conhecidos
  const cargasPlano = useMemo<Carga[]>(
    () =>
      linhas
        .filter(
          (l): l is Linha & { origem: Local; destino: Local } =>
            !!l.origem && !!l.destino && l.origem.id !== l.destino.id && valorEfetivo(l.oferta) != null,
        )
        .map((l) => ({ oferta: l.oferta, origem: l.origem, destino: l.destino })),
    [linhas],
  );
  const basePlano = locais.find((l) => l.id === truck.baseLocalId) ?? null;
  const inicioPlano = locais.find((l) => l.id === posicaoId) ?? basePlano;

  if (!sessaoPronta) return <div className="skel" />;

  // ---- PHASE: REVIEW ----
  if (fase === "REVISAO") {
    return (
      <ReviewScreen
        ofertas={ofertasBrutas}
        onConfirmar={confirmarRevisao}
        onVoltar={voltarParaInput}
      />
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Cargas"
        title="Qual carga vale mais?"
        lead="Cole as ofertas do WhatsApp ou anexe os prints. Eu separo cada carga, calculo o lucro e mostro qual rota compensa."
      />

      {fase === "INPUT" && !lendo && (
        <ol className="steps" aria-label="Como funciona">
          <li>
            <b>1</b>Cole ou anexe as ofertas
          </li>
          <li>
            <b>2</b>Confira o que a IA entendeu
          </li>
          <li>
            <b>3</b>Compare o lucro por hora
          </li>
        </ol>
      )}

      {semLocais && (
        <Note tone="warn" icon="pin">
          Comece cadastrando seus locais. <Link href="/locais">Ir para Locais</Link>
        </Note>
      )}

      <section className="card">
        <label className="lbl" htmlFor={`msg-${m0.id}`}>
          Mensagem com uma ou várias cargas
        </label>
        <textarea
          id={`msg-${m0.id}`}
          value={m0.texto}
          onChange={(e) => atualizarMensagem({ texto: e.target.value })}
          placeholder="Cole aqui as ofertas do WhatsApp. Pode ser mais de uma, seguidas — eu separo origem, destino e preço de cada uma."
        />
        <div className="tools">
          <button type="button" className="btn ghost sm" onClick={colar}>
            <Icon name="paste" size={18} />
            Colar
          </button>
          <label className="btn ghost sm pick">
            <Icon name="image" size={18} />
            Anexar print
            <input type="file" className="sr-only" accept="image/*" multiple onChange={(e) => { anexar(e.target.files); e.target.value = ""; }} />
          </label>
          {(m0.texto || m0.imagens.length > 0) && (
            <button type="button" className="btn ghost sm" onClick={() => { atualizarMensagem({ texto: "", imagens: [] }); voltarParaInput(); }}>
              Limpar
            </button>
          )}
        </div>
        <Miniaturas arquivos={m0.imagens} onRemover={(i) => atualizarMensagem({ imagens: m0.imagens.filter((_, k) => k !== i) })} />

        <hr className="sep" />

        <div className="field">
          <label htmlFor="pos">Onde você está agora</label>
          <select id="pos" value={posicaoId} onChange={(e) => setPosicaoId(e.target.value)}>
            <option value="">Já estou na origem (sem km vazio)</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.apelido}
              </option>
            ))}
          </select>
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="hora">Hora agora</label>
            <input id="hora" type="time" value={agora} onChange={(e) => { setAgora(e.target.value); setAgoraManual(true); }} />
          </div>
          <div className="field">
            <label htmlFor="ton">Carga</label>
            <div className="inp has-unit">
              <NumInput id="ton" value={ton} onChange={setToneladas} />
              <span className="unit">t</span>
            </div>
          </div>
        </div>

        {truck.baseLocalId && (
          <label className="switch">
            <span>
              Contar a volta até a base
              <small>Soma o km vazio do retorno</small>
            </span>
            <input className="sw" type="checkbox" checked={comRetorno} onChange={(e) => setComRetorno(e.target.checked)} />
          </label>
        )}

        {erro && (
          <Note tone="loss" icon="alert">
            {erro}
          </Note>
        )}
        {infoIA && (
          <Note tone="gain" icon="check">
            {infoIA}
          </Note>
        )}

        <div className="sticky-cta">
          <button type="button" className="btn block" onClick={analisar} disabled={lendo || mensagensPreenchidas.length === 0}>
            {lendo ? <span className="spinner" aria-hidden="true" /> : <Icon name="bolt" size={22} />}
            {lendo ? "Analisando as cargas..." : "Analisar cargas"}
          </button>
        </div>
      </section>

      {faltando.length > 0 && (
        <>
          <h2>Locais novos</h2>
          <p className="lead" style={{ marginBottom: 12 }}>
            Preciso do endereço de {faltando.length === 1 ? "um local" : "alguns locais"} para calcular. É só uma vez.
          </p>
          {faltando.map((nome) => (
            <div className="card attn" key={nome}>
              <LocalForm apelidoInicial={nome} onSalvar={(l) => setLocais((prev) => [...prev, l])} rotulo={`Salvar ${nome}`} />
            </div>
          ))}
        </>
      )}

      {calculando && ofertas.length > 0 && (
        <>
          <div className="calc-status">
            <span className="spinner" aria-hidden="true" />
            Calculando rotas...
          </div>
          {calculadas.ok.length === 0 && <div className="skel" />}
        </>
      )}

      {/* Sequência: casa → carga → carga → casa (com 2+ cargas utilizáveis) */}
      {fase === "RESULTADO" && cargasPlano.length >= 2 && (
        <PlanoPanel
          cargas={cargasPlano}
          excluidas={linhas.length - cargasPlano.length}
          truck={truck}
          inicio={inicioPlano}
          base={basePlano}
          toneladas={ton}
          agoraMin={parseHora(agora)}
          onEscolher={escolherPlano}
        />
      )}

      {/* Comparison Panel - shows when 2+ viable loads */}
      {compareLinhas.length >= 2 && <ComparePanel linhas={compareLinhas} />}

      {calculadas.ok.length > 0 && (
        <>
          <div className="results-head">
            <div>
              <h2>Resultado</h2>
              <p className="hint">
                {calculadas.ok.length} {calculadas.ok.length === 1 ? "carga" : "cargas"} · {fmtNum(ton)} t · análise salva neste aparelho
              </p>
            </div>
            <Segmented
              label="Ordenar por"
              value={ordem}
              onChange={setOrdem}
              options={[
                { value: "HORA", label: "Por hora" },
                { value: "LUCRO", label: "Por lucro" },
              ]}
            />
          </div>
          {calculadas.melhorHora && (
            <Note tone="gain" icon="bolt">
              <strong>Dica:</strong> o melhor retorno por hora considera lucro, diesel, pedágio, manutenção e o tempo da viagem, não só o maior frete.
            </Note>
          )}
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
              onEscolher={() => escolherCarga(l)}
            />
          ))}
        </>
      )}

      {calculadas.semValor.length > 0 && (
        <>
          <h2>Sem preço na mensagem</h2>
          <p className="lead" style={{ marginBottom: 12 }}>
            Digite o frete para ver o lucro. Carga considerada: {fmtNum(ton)} t.
          </p>
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
