/** Local especial (não fica salvo em "Locais"): representa "onde estou agora" via GPS. */
export const GPS_ATUAL_ID = "gps-atual";

export function geolocalizacaoDisponivel(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/** Mensagem amigável a partir do erro nativo do navegador (permissão negada, sinal fraco, etc.). */
function mensagemErro(e: GeolocationPositionError): string {
  switch (e.code) {
    case e.PERMISSION_DENIED:
      return "Você não deixou o app acessar o GPS. Autorize a localização nas permissões do navegador e tente de novo.";
    case e.POSITION_UNAVAILABLE:
      return "Não consegui captar o GPS agora. Tente de novo ao ar livre, longe de galpões ou serra.";
    case e.TIMEOUT:
      return "O GPS demorou demais pra responder. Tente de novo.";
    default:
      return "Não consegui pegar sua localização agora.";
  }
}

/**
 * Pede a posição atual do celular pelo navegador (Geolocation API nativa). Exige HTTPS
 * (ou localhost) e a permissão do usuário — o navegador mostra o aviso na tela sozinho.
 */
export function obterCoordenadasAtuais(): Promise<{ lat: number; lng: number; precisaoM: number | null }> {
  return new Promise((resolve, reject) => {
    if (!geolocalizacaoDisponivel()) {
      reject(new Error("Este navegador não consegue acessar o GPS."));
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      reject(new Error("Para usar o GPS, abra o app por um endereço https:// (ou instalado como app)."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        resolve({
          lat: posicao.coords.latitude,
          lng: posicao.coords.longitude,
          precisaoM: posicao.coords.accuracy ?? null,
        });
      },
      (erro) => reject(new Error(mensagemErro(erro))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

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
