"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient, supabaseConfigurado } from "./supabase/client.ts";

type AuthCtx = {
  user: User | null;
  carregando: boolean;
  disponivel: boolean; // false se o site não tem Supabase configurado
  entrar: (email: string) => Promise<void>;
  sair: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  carregando: false,
  disponivel: false,
  entrar: async () => {},
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
    supabase.auth.getUser().then((res) => {
      if (!ativo) return;
      setUser(res.data?.user ?? null);
      setCarregando(false);
    });
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento: AuthChangeEvent, sessao: Session | null) => {
      setUser(sessao?.user ?? null);
    });
    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
    };
  }, [disponivel]);

  async function entrar(email: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }

  return <Ctx.Provider value={{ user, carregando, disponivel, entrar, sair }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
