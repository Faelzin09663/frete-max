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

/** Acha o local cadastrado que corresponde ao texto da mensagem. */
export function acharLocal(texto: string, locais: Local[]): Local | null {
  const t = normalizar(texto);
  if (!t) return null;
  // 1) igualdade exata com apelido ou sinônimo
  for (const l of locais) {
    const nomes = [l.apelido, ...l.sinonimos].map(normalizar);
    if (nomes.includes(t)) return l;
  }
  // 2) o texto contém um nome cadastrado (ex.: "Tejucana Rocha Brumadinho" contém "rocha")
  //    escolhe o nome mais longo para evitar falso positivo
  let melhor: { l: Local; len: number } | null = null;
  for (const l of locais) {
    for (const n of [l.apelido, ...l.sinonimos].map(normalizar)) {
      if (n.length >= 3 && (` ${t} `.includes(` ${n} `) || ` ${n} `.includes(` ${t} `))) {
        if (!melhor || n.length > melhor.len) melhor = { l, len: n.length };
      }
    }
  }
  return melhor?.l ?? null;
}
