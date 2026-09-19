import { decodePolyline } from "./polyline.ts";
import type { Leg, Local, MapaDados, Ponto } from "./types.ts";

function traco(a: Local, b: Local, leg: Leg): Ponto[] {
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
