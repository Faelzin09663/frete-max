import type { Leg, Local } from "./types.ts";

type P = Pick<Local, "lat" | "lng">;

export function haversineKm(a: P, b: P): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Estimativa grátis (sem Google): linha reta x 1,35, a ~60 km/h. Mesma conta de app/api/route. */
export function estimarLeg(a: P, b: P): Leg {
  const km = haversineKm(a, b) * 1.35;
  return { km, min: km, tollRS: 0, estimado: true };
}

/** Chave estável de um trecho (direcional: A→B pode ser diferente de B→A). */
export const chaveLeg = (a: P, b: P) =>
  `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
