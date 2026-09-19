import { NextResponse } from "next/server";
import type { Leg } from "@/lib/types.ts";

export const runtime = "nodejs";

type P = { lat: number; lng: number };

function haversineKm(a: P, b: P): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function estimar(a: P, b: P): Leg {
  const km = haversineKm(a, b) * 1.35; // fator de sinuosidade das estradas
  return { km, min: km, tollRS: 0, estimado: true }; // ~60 km/h
}

export async function POST(req: Request) {
  const { origem, destino } = (await req.json()) as { origem: P; destino: P };
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json(estimar(origem, destino));

  const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origem.lat, longitude: origem.lng } } },
      destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      polylineQuality: "OVERVIEW",
      extraComputations: ["TOLLS"],
      routeModifiers: { vehicleInfo: { emissionType: "DIESEL" } },
      languageCode: "pt-BR",
      units: "METRIC",
    }),
  });

  if (!r.ok) {
    // não trava o app: cai na estimativa
    return NextResponse.json(estimar(origem, destino));
  }
  const data = await r.json();
  const route = data?.routes?.[0];
  if (!route) return NextResponse.json(estimar(origem, destino));

  const km = (route.distanceMeters ?? 0) / 1000;
  const min = parseInt(String(route.duration ?? "0").replace("s", ""), 10) / 60;
  const prices: { currencyCode?: string; units?: string; nanos?: number }[] =
    route.travelAdvisory?.tollInfo?.estimatedPrice ?? [];
  const tollRS = prices
    .filter((p) => !p.currencyCode || p.currencyCode === "BRL")
    .reduce((s, p) => s + Number(p.units ?? 0) + (p.nanos ?? 0) / 1e9, 0);

  const leg: Leg = { km, min, tollRS, estimado: false, poly: route.polyline?.encodedPolyline };
  return NextResponse.json(leg);
}
