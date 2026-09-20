import { decodePolyline } from "./polyline.ts";
import type { Plano } from "./plano.ts";
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

/** Mapa da sequência inteira: casa → cargas → casa (vazio tracejado, cheio em linha grossa). */
export function montarMapaPlano(p: Plano): MapaDados {
  const segmentos: MapaDados["segmentos"] = [];
  for (const s of p.passos) {
    if (s.de.id !== s.carga.origem.id) segmentos.push({ tipo: "VAZIO", pontos: traco(s.de, s.carga.origem, s.vazio) });
    segmentos.push({ tipo: "CHEIO", pontos: traco(s.carga.origem, s.carga.destino, s.cheio) });
  }
  const ultimo = p.passos[p.passos.length - 1].carga.destino;
  if (p.fim && p.retorno && p.fim.id !== ultimo.id) {
    segmentos.push({ tipo: "VAZIO", pontos: traco(ultimo, p.fim, p.retorno) });
  }

  // uma marca por lugar: se o mesmo local aparece mais de uma vez (ex.: sai e chega em casa,
  // descarrega e já carrega no mesmo ponto), os rótulos são juntos numa marca só
  type Parada = { local: Local; rotulos: string[]; papel: MapaDados["marcadores"][number]["papel"] };
  const paradas = new Map<string, Parada>();
  const marca = (local: Local, rotulo: string, papel: Parada["papel"]) => {
    const e = paradas.get(local.id);
    if (e) e.rotulos.push(rotulo);
    else paradas.set(local.id, { local, rotulos: [rotulo], papel });
  };
  marca(p.inicio, "saída", "POSICAO");
  p.passos.forEach((s, i) => {
    marca(s.carga.origem, `${i + 1}º carrega`, "ORIGEM");
    marca(s.carga.destino, `${i + 1}º descarrega`, "DESTINO");
  });
  if (p.fim) marca(p.fim, "chegada", "BASE");

  const marcadores = [...paradas.values()].map((e) => ({
    nome: `${e.local.apelido} (${e.rotulos.join(", ")})`,
    lat: e.local.lat,
    lng: e.local.lng,
    papel: e.papel,
  }));

  // Link do Google Maps: saída → (cada carga e descarga) → chegada. O Google aceita até 9 paradas.
  const ll = (l: Local) => `${l.lat},${l.lng}`;
  const pontos: Local[] = [];
  for (const s of p.passos) pontos.push(s.carga.origem, s.carga.destino);
  const destinoFinal = p.fim ?? ultimo;
  const paradasIntermediarias = pontos
    .filter((l, i) => l.id !== (i === 0 ? p.inicio.id : pontos[i - 1].id))
    .filter((l, i, arr) => !(i === arr.length - 1 && l.id === destinoFinal.id))
    .slice(0, 9);
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", ll(p.inicio));
  u.searchParams.set("destination", ll(destinoFinal));
  if (paradasIntermediarias.length > 0) u.searchParams.set("waypoints", paradasIntermediarias.map(ll).join("|"));
  u.searchParams.set("travelmode", "driving");

  return { segmentos, marcadores, linkGoogle: u.toString() };
}
