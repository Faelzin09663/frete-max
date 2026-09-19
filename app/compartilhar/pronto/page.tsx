"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    <p className="lead">
      {erro
        ? "Não consegui abrir o que foi compartilhado. Volte ao WhatsApp e cole a mensagem manualmente."
        : "Abrindo a carga compartilhada..."}
    </p>
  );
}
