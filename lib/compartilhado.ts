"use client";

/**
 * Handoff em memória entre /compartilhar/pronto e a tela de Cargas (mesma
 * navegação client-side, então não precisa de sessionStorage nem IndexedDB
 * pro texto/arquivos — só sobrevive dentro da mesma aba).
 */
let pendente: { texto: string; imagens: File[] } | null = null;

export function definirCompartilhado(v: { texto: string; imagens: File[] }) {
  pendente = v;
}

export function consumirCompartilhado(): { texto: string; imagens: File[] } | null {
  const v = pendente;
  pendente = null;
  return v;
}
