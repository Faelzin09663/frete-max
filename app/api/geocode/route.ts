import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Aceita "lat, lng" direto (ex.: copiado do Google Maps) ou um endereço.
const COORD = /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/;

export async function POST(req: Request) {
  const { endereco } = (await req.json()) as { endereco?: string };
  if (!endereco?.trim()) return NextResponse.json({ error: "Informe o endereço." }, { status: 400 });

  const c = COORD.exec(endereco);
  if (c) {
    return NextResponse.json({ lat: Number(c[1]), lng: Number(c[2]), formatado: endereco.trim() });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Sem GOOGLE_MAPS_API_KEY. Cole as coordenadas do Google Maps (ex.: -19.9245, -43.9352) no lugar do endereço.",
      },
      { status: 400 },
    );
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", endereco);
  url.searchParams.set("region", "br");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("key", key);
  const r = await fetch(url);
  const data = await r.json();
  const first = data?.results?.[0];
  if (!first) {
    return NextResponse.json({ error: `Endereço não encontrado (${data?.status ?? "?"}).` }, { status: 404 });
  }
  return NextResponse.json({
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formatado: first.formatted_address,
  });
}
