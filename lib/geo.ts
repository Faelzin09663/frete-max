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
