import type { Ponto } from "./types.ts";

/** Decodifica a "encoded polyline" do Google (precisão 1e-5). */
export function decodePolyline(enc: string): Ponto[] {
  const out: Ponto[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < enc.length) {
    for (const eixo of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do {
        b = enc.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < enc.length + 1);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (eixo === 0) lat += delta;
      else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}
