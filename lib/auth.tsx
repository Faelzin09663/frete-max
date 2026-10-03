"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, supabaseConfigurado } from "./supabase/client.ts";

type AuthCtx = {
  user: User | null;
  carregando: boolean;
  disponivel: boolean; // false se o site não tem Supabase configurado
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  carregando: false,
  disponivel: false,
  entrar: async () => {},
  cadastrar: async () => {},
  sair: async () => {},
});

/**
 * Login é opcional em todo o app: sem entrar, tudo funciona salvando só no
 * navegador (como no MVP). Entrando, `lib/storage.ts` passa a sincronizar
 * Caminhão e Locais com o Supabase em segundo plano.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const disponivel = supabaseConfigurado();
  const [user, setUser] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(disponivel);

  useEffect(() => {
    if (!disponivel) return;
    const supabase = createClient();
    let ativo = true;
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      if (!ativo) return;
      setUser(data.user);
      setCarregando(false);
    });
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento: string, sessao: any) => {
      setUser(sessao?.user ?? null);
    });
    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
    };
  }, [disponivel]);

  async function entrar(email: string, senha: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
  }

  async function cadastrar(nome: string, email: string, senha: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error("Cadastro criado, mas o Supabase exige confirmação de e-mail. Desative 'Confirm email' em Authentication > Providers > Email.");
    }
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }

  return <Ctx.Provider value={{ user, carregando, disponivel, entrar, cadastrar, sair }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
