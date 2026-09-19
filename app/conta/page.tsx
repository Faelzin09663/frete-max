"use client";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icons";
import { Field, Note, PageHead } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { exportarJSON, exportarViagensCSV, importarJSON } from "@/lib/export.ts";
import { useLocais, useTruck, useViagens } from "@/lib/storage.ts";

export default function ContaPage() {
  return (
    <Suspense fallback={<div className="skel" />}>
      <ContaConteudo />
    </Suspense>
  );
}

function BackupSection() {
  const [truck, setTruck] = useTruck();
  const [locais, setLocais] = useLocais();
  const [viagens, setViagens] = useViagens();
  const [msg, setMsg] = useState<{ tipo: "gain" | "loss"; texto: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExportarJSON() {
    try {
      exportarJSON(truck, locais, viagens);
      setMsg({ tipo: "gain", texto: "Backup JSON baixado com sucesso!" });
    } catch {
      setMsg({ tipo: "loss", texto: "Erro ao gerar backup JSON." });
    }
  }

  function handleExportarCSV() {
    try {
      if (viagens.length === 0) {
        setMsg({ tipo: "loss", texto: "Nenhuma viagem cadastrada para exportar." });
        return;
      }
      exportarViagensCSV(viagens);
      setMsg({ tipo: "gain", texto: "Planilha CSV de viagens baixada com sucesso!" });
    } catch {
      setMsg({ tipo: "loss", texto: "Erro ao gerar planilha CSV." });
    }
  }

  async function handleImportarJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importarJSON(file);
      setTruck(data.truck);
      setLocais(data.locais);
      setViagens(data.viagens);
      setMsg({
        tipo: "gain",
        texto: `Backup restaurado com sucesso: ${data.locais.length} locais e ${data.viagens.length} viagens recuperadas!`,
      });
    } catch (err) {
      setMsg({ tipo: "loss", texto: err instanceof Error ? err.message : "Erro ao importar backup." });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <h2>Backup e Exportação</h2>
      <p className="hint" style={{ margin: "0 0 16px" }}>
        Exporte seus dados para não perder seu histórico ou transfira para outro celular sem precisar de login.
      </p>

      {msg && (
        <div style={{ marginBottom: 16 }}>
          <Note tone={msg.tipo} icon={msg.tipo === "gain" ? "check" : "alert"}>
            {msg.texto}
          </Note>
        </div>
      )}

      <div className="backup-actions">
        <button type="button" className="btn ghost block" onClick={handleExportarJSON}>
          <Icon name="download" size={18} />
          Exportar tudo (Backup JSON)
        </button>

        <label className="btn ghost block pick" style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="upload" size={18} />
          Restaurar backup (Importar JSON)
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={handleImportarJSON}
          />
        </label>

        <button type="button" className="btn ghost block" onClick={handleExportarCSV}>
          <Icon name="download" size={18} />
          Exportar viagens (Planilha CSV)
        </button>
      </div>
    </section>
  );
}

function ContaConteudo() {
  const { user, carregando, disponivel, entrar, sair } = useAuth();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(params.get("erro") ? "O link expirou ou já foi usado. Peça um novo." : null);
  const [busy, setBusy] = useState(false);

  if (!disponivel) {
    return (
      <>
        <PageHead eyebrow="Conta" title="Modo local" />
        <Note tone="warn" icon="cloud">
          A sincronização na nuvem ainda não foi configurada neste site (faltam as chaves do Supabase no servidor). O app continua funcionando normalmente, guardando tudo só neste aparelho.
        </Note>
        <BackupSection />
      </>
    );
  }

  if (carregando) {
    return (
      <>
        <PageHead eyebrow="Conta" title="Sua conta" />
        <div className="skel" />
      </>
    );
  }

  if (user) {
    return (
      <>
        <PageHead eyebrow="Conta" title="Sua conta" />
        <section className="card">
          <div className="profile">
            <div className="avatar">{(user.email ?? "?").charAt(0)}</div>
            <div>
              <small className="hint" style={{ margin: 0 }}>
                Conectado como
              </small>
              <strong>{user.email}</strong>
            </div>
          </div>
          <ul className="perks">
            <li>
              <Icon name="check" size={18} />
              Caminhão e Locais salvos na nuvem e disponíveis em qualquer celular desta conta.
            </li>
            <li>
              <Icon name="check" size={18} />
              As Cargas e o Painel continuam só neste aparelho.
            </li>
          </ul>
          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn ghost block" onClick={() => sair()}>
              Sair da conta
            </button>
          </div>
        </section>
        <BackupSection />
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
      <PageHead
        eyebrow="Conta"
        title="Entrar é opcional"
        lead="Sem entrar, tudo fica só neste aparelho. Com e-mail, Caminhão e Locais ficam salvos e você usa o FreteMax em outro celular sem recadastrar."
      />
      <section className="card">
        {enviado ? (
          <Note tone="gain" icon="check">
            Link enviado para <strong>{email}</strong>. Abra o e-mail neste celular e toque no link para entrar.
          </Note>
        ) : (
          <>
            <Field label="E-mail" htmlFor="email">
              <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" />
            </Field>
            {erro && <Note tone="loss">{erro}</Note>}
            <div style={{ marginTop: 16 }}>
              <button type="button" className="btn block" onClick={enviarLink} disabled={busy || !email.trim()}>
                {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="cloud" size={20} />}
                {busy ? "Enviando..." : "Receber link por e-mail"}
              </button>
            </div>
          </>
        )}
      </section>
      <BackupSection />
    </>
  );
}
