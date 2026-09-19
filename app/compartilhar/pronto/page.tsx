"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icons";
import { definirCompartilhado } from "@/lib/compartilhado.ts";

const CACHE = "fretemax-compartilhado-v1";

export default function CompartilharProntoPage() {
  const router = useRouter();
  const [erro, setErro] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!("caches" in window)) throw new Error("sem Cache Storage");
        const cache = await caches.open(CACHE);
        const respDados = await cache.match("/compartilhado-dados");
        const dados = respDados ? await respDados.json() : { texto: "", n: 0 };

        const imagens: File[] = [];
        for (let i = 0; i < (dados.n ?? 0); i++) {
          const r = await cache.match(`/compartilhado-imagem-${i}`);
          if (r) {
            const blob = await r.blob();
            imagens.push(new File([blob], `compartilhado-${i}.jpg`, { type: blob.type || "image/jpeg" }));
          }
        }

        await Promise.all([
          cache.delete("/compartilhado-dados"),
          ...Array.from({ length: dados.n ?? 0 }, (_, i) => cache.delete(`/compartilhado-imagem-${i}`)),
        ]);

        definirCompartilhado({ texto: dados.texto ?? "", imagens });
        router.replace("/?compartilhado=1");
      } catch {
        setErro(true);
      }
    })();
  }, [router]);

  return (
    <div className="empty" role="status" style={{ marginTop: 24 }}>
      <div className="ic">{erro ? <Icon name="alert" size={24} /> : <span className="spinner" aria-hidden="true" />}</div>
      <strong>{erro ? "Não abriu" : "Abrindo a carga"}</strong>
      <p>
        {erro
          ? "Não consegui abrir o que foi compartilhado. Volte ao WhatsApp e cole a mensagem manualmente."
          : "Trazendo o que você compartilhou do WhatsApp..."}
      </p>
    </div>
  );
}
