"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth.tsx";

export default function ContaPage() {
  const { user, carregando, disponivel, entrar, sair } = useAuth();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(params.get("erro") ? "O link expirou ou já foi usado. Peça um novo." : null);
  const [busy, setBusy] = useState(false);

  if (!disponivel) {
    return (
      <>
        <h1>Conta</h1>
        <div className="note">
          A sincronização na nuvem ainda não foi configurada neste site (faltam as chaves do Supabase no
          servidor). O app continua funcionando normalmente, guardando tudo só neste aparelho.
        </div>
      </>
    );
  }

  if (carregando) {
    return (
      <>
        <h1>Conta</h1>
        <p className="lead">Carregando...</p>
      </>
    );
  }

  if (user) {
    return (
      <>
        <h1>Conta</h1>
        <div className="panel">
          <p>
            Conectado como <strong>{user.email}</strong>.
          </p>
          <p className="hint">
            Caminhão e Locais são salvos automaticamente na nuvem e aparecem em qualquer celular que entrar
            nesta mesma conta. As Cargas continuam só neste aparelho.
          </p>
          <div className="actions">
            <button className="sec" onClick={() => sair()}>
              Sair
            </button>
          </div>
        </div>
      </>
    );
  }

  async function enviarLink() {
    setErro(null);
    setBusy(true);
    try {
      await entrar(email.trim());
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao enviar o link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Conta</h1>
      <p className="lead">
        Entrar é opcional. Sem entrar, tudo fica só neste aparelho, como hoje. Entrando com e-mail, Caminhão
        e Locais passam a ficar salvos e você pode usar o FreteMax em outro celular sem recadastrar tudo.
      </p>
      <div className="panel">
        {enviado ? (
          <p>
            Link enviado para <strong>{email}</strong>. Abra o e-mail neste celular e toque no link para
            entrar.
          </p>
        ) : (
          <>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
            />
            {erro && <div className="error">{erro}</div>}
            <div className="actions">
              <button onClick={enviarLink} disabled={busy || !email.trim()}>
                {busy ? "Enviando..." : "Entrar com e-mail"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
