import type { Local } from "./types.ts";

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Candidato = {
  local: Local;
  nivel: "EXATO" | "PARECIDO";
  pontos: number; // exato = 1000; parecido = tamanho do nome que casou (nome mais longo = mais específico)
};

/**
 * Locais que podem ser o citado na mensagem, do mais provável ao menos.
 * EXATO: o texto é igual ao apelido ou a um sinônimo.
 * PARECIDO: o texto contém um nome cadastrado (ou o contrário), ex.: "Tejucana - Rocha (Brumadinho)" contém "Rocha".
 */
export function candidatosLocais(texto: string, locais: Local[]): Candidato[] {
  const t = normalizar(texto);
  if (!t) return [];
  const exatos: Candidato[] = [];
  const parecidos: Candidato[] = [];
  for (const l of locais) {
    const nomes = [l.apelido, ...l.sinonimos].map(normalizar).filter(Boolean);
    if (nomes.includes(t)) {
      exatos.push({ local: l, nivel: "EXATO", pontos: 1000 });
      continue;
    }
    let melhor = 0;
    for (const n of nomes) {
      if (n.length >= 3 && (` ${t} `.includes(` ${n} `) || ` ${n} `.includes(` ${t} `))) melhor = Math.max(melhor, n.length);
    }
    if (melhor > 0) parecidos.push({ local: l, nivel: "PARECIDO", pontos: melhor });
  }
  parecidos.sort((a, b) => b.pontos - a.pontos); // estável: empate mantém a ordem do cadastro
  return [...exatos, ...parecidos];
}

/** Acha o local cadastrado que corresponde ao texto da mensagem (o mais provável). */
export function acharLocal(texto: string, locais: Local[]): Local | null {
  return candidatosLocais(texto, locais)[0]?.local ?? null;
}

/**
 * Local de uma oferta: se o motorista escolheu um à mão na conferência, vale a escolha;
 * senão (ou se o local escolhido foi apagado depois) usa o reconhecimento pelo nome.
 */
export function resolverLocal(texto: string, escolhidoId: string | null | undefined, locais: Local[]): Local | null {
  if (escolhidoId) {
    const l = locais.find((x) => x.id === escolhidoId);
    if (l) return l;
  }
  return acharLocal(texto, locais);
}

/** true quando mais de um local cadastrado casa igualmente bem com o texto (ex.: 3 mineradoras em Sete Lagoas). */
export function ehAmbiguo(texto: string, locais: Local[]): boolean {
  const c = candidatosLocais(texto, locais);
  if (c.length < 2) return false;
  return c.filter((x) => x.pontos === c[0].pontos).length > 1;
}

/** Devolve o local com o nome acrescentado como sinônimo (sem repetir). Se nada mudar, devolve o mesmo objeto. */
export function adicionarSinonimo(local: Local, nome: string): Local {
  const n = normalizar(nome);
  if (!n) return local;
  const ja = [local.apelido, ...local.sinonimos].map(normalizar);
  if (ja.includes(n)) return local;
  return { ...local, sinonimos: [...local.sinonimos, nome.trim()] };
}
