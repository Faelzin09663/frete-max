// FreteMax — service worker mínimo, só para o "Compartilhar" do Android (PWA share_target).
// Não faz cache de páginas nem funciona offline nesta fase.

const CACHE = "fretemax-compartilhado-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/compartilhar") {
    event.respondWith(Response.redirect("/compartilhar/pronto", 303));
    event.waitUntil(salvarCompartilhado(event.request));
  }
  // demais pedidos seguem direto pra rede (sem interceptar)
});

async function salvarCompartilhado(request) {
  try {
    const formData = await request.formData();
    const texto = formData.get("texto") || formData.get("titulo") || "";
    const imagens = formData.getAll("imagens").filter((v) => v instanceof File && v.size > 0);

    const cache = await caches.open(CACHE);
    await cache.put("/compartilhado-dados", new Response(JSON.stringify({ texto: String(texto), n: imagens.length })));
    await Promise.all(
      imagens.map((file, i) =>
        cache.put(
          `/compartilhado-imagem-${i}`,
          new Response(file, { headers: { "Content-Type": file.type || "image/jpeg" } }),
        ),
      ),
    );
  } catch {
    // se der errado, /compartilhar/pronto não acha nada no cache e avisa pra colar manualmente
  }
}
