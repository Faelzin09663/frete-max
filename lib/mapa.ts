import { decodePolyline } from "./polyline.ts";
import type { Leg, Local, MapaDados, Ponto } from "./types.ts";

export function traco(a: Local, b: Local, leg: Leg): Ponto[] {
  if (leg.poly) {
    const p = decodePolyline(leg.poly);
    if (p.length > 1) return p;
  }
  return [[a.lat, a.lng], [b.lat, b.lng]]; // sem Google: linha reta
}

export function montarMapa(
  pos: Local | null,
  origem: Local,
  destino: Local,
  base: Local | null,
  vazio: Leg,
  cheio: Leg,
  retorno: Leg | null,
): MapaDados {
  const segmentos: MapaDados["segmentos"] = [];
  if (pos && pos.id !== origem.id) segmentos.push({ tipo: "VAZIO", pontos: traco(pos, origem, vazio) });
  segmentos.push({ tipo: "CHEIO", pontos: traco(origem, destino, cheio) });
  if (base && retorno && base.id !== destino.id) {
    segmentos.push({ tipo: "VAZIO", pontos: traco(destino, base, retorno) });
  }

  const marcadores: MapaDados["marcadores"] = [];
  if (pos) marcadores.push({ nome: pos.apelido, lat: pos.lat, lng: pos.lng, papel: "POSICAO" });
  marcadores.push({ nome: origem.apelido, lat: origem.lat, lng: origem.lng, papel: "ORIGEM" });
  marcadores.push({ nome: destino.apelido, lat: destino.lat, lng: destino.lng, papel: "DESTINO" });
  if (base) marcadores.push({ nome: base.apelido, lat: base.lat, lng: base.lng, papel: "BASE" });

  // Link para navegar no app do Google Maps (sem chave de API): posição -> origem -> destino
  const ll = (l: Local) => `${l.lat},${l.lng}`;
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", ll(pos ?? origem));
  u.searchParams.set("destination", ll(destino));
  if (pos && pos.id !== origem.id) u.searchParams.set("waypoints", ll(origem));
  u.searchParams.set("travelmode", "driving");

  return { segmentos, marcadores, linkGoogle: u.toString() };
}

/** Monta o mapa de uma sequência inteira: posição -> carga 1 -> carga 2 -> ... -> base (se houver). */
export function montarMapaSequencia(
  pos: Local,
  etapas: { origem: Local; destino: Local; vazio: Leg; cheio: Leg }[],
  base: Local | null,
  retorno: Leg | null,
): MapaDados {
  const segmentos: MapaDados["segmentos"] = [];
  const marcadores: MapaDados["marcadores"] = [{ nome: pos.apelido, lat: pos.lat, lng: pos.lng, papel: "POSICAO" }];

  let atual = pos;
  for (const e of etapas) {
    if (atual.id !== e.origem.id) segmentos.push({ tipo: "VAZIO", pontos: traco(atual, e.origem, e.vazio) });
    segmentos.push({ tipo: "CHEIO", pontos: traco(e.origem, e.destino, e.cheio) });
    marcadores.push({ nome: e.origem.apelido, lat: e.origem.lat, lng: e.origem.lng, papel: "ORIGEM" });
    marcadores.push({ nome: e.destino.apelido, lat: e.destino.lat, lng: e.destino.lng, papel: "DESTINO" });
    atual = e.destino;
  }
  if (base && retorno && atual.id !== base.id) {
    segmentos.push({ tipo: "VAZIO", pontos: traco(atual, base, retorno) });
    marcadores.push({ nome: base.apelido, lat: base.lat, lng: base.lng, papel: "BASE" });
  }

  const ll = (l: Local) => `${l.lat},${l.lng}`;
  const destinoFinal = base && retorno && atual.id === base.id ? base : (etapas[etapas.length - 1]?.destino ?? pos);
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", ll(pos));
  u.searchParams.set("destination", ll(destinoFinal));
  const waypoints: string[] = [];
  etapas.forEach((e, i) => {
    if (i > 0 || pos.id !== e.origem.id) waypoints.push(ll(e.origem));
    const ultima = i === etapas.length - 1;
    if (!ultima || (base && retorno)) waypoints.push(ll(e.destino));
  });
  if (waypoints.length) u.searchParams.set("waypoints", waypoints.join("|"));
  u.searchParams.set("travelmode", "driving");

  return { segmentos, marcadores, linkGoogle: u.toString() };
}
