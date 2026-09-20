"use client";
import { useEffect, useId, useState } from "react";
import { Field } from "@/components/ui";
import { Note } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { geocodificar, geocodificarReverso } from "@/lib/client-api.ts";
import { geolocalizacaoDisponivel, obterCoordenadasAtuais } from "@/lib/geo.ts";
import { novoId } from "@/lib/storage.ts";
import type { Local } from "@/lib/types.ts";

export function LocalForm({
  apelidoInicial = "",
  sinonimoInicial = "",
  onSalvar,
  rotulo = "Salvar local",
}: {
  apelidoInicial?: string;
  sinonimoInicial?: string;
  onSalvar: (l: Local) => void;
  rotulo?: string;
}) {
  const uid = useId();
  const [apelido, setApelido] = useState(apelidoInicial);
  const [sinonimos, setSinonimos] = useState(sinonimoInicial);
  const [endereco, setEndereco] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Coordenadas exatas do GPS, quando o endereço veio do botão "usar minha localização".
  // Editar o campo de endereço à mão descarta essas coordenadas (volta a geocodificar o texto).
  const [coordsGps, setCoordsGps] = useState<{ lat: number; lng: number } | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);
  // Geolocation só existe no navegador: decide depois de montar, pra não divergir do HTML do servidor.
  const [gpsDisponivel, setGpsDisponivel] = useState(false);
  useEffect(() => setGpsDisponivel(geolocalizacaoDisponivel()), []);

  async function usarLocalizacaoAtual() {
    setErro(null);
    setBuscandoGps(true);
    try {
      const { lat, lng } = await obterCoordenadasAtuais();
      setCoordsGps({ lat, lng });
      setEndereco(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); // já mostra algo, mesmo se a busca abaixo falhar
      try {
        const g = await geocodificarReverso(lat, lng);
        setEndereco(g.formatado);
      } catch {
        /* fica com as coordenadas cruas mesmo, não é um erro que impeça salvar */
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui pegar sua localização.");
    } finally {
      setBuscandoGps(false);
    }
  }

  async function salvar() {
    setErro(null);
    if (!apelido.trim() || !endereco.trim()) {
      setErro("Preencha o apelido e o endereço.");
      return;
    }
    setBusy(true);
    try {
      let lat: number, lng: number, formatado: string;
      if (coordsGps) {
        lat = coordsGps.lat;
        lng = coordsGps.lng;
        formatado = endereco.trim();
      } else {
        const g = await geocodificar(endereco);
        lat = g.lat;
        lng = g.lng;
        formatado = g.formatado;
      }
      onSalvar({
        id: novoId(),
        apelido: apelido.trim(),
        sinonimos: sinonimos.split(",").map((s) => s.trim()).filter(Boolean),
        endereco: formatado,
        lat,
        lng,
      });
      setApelido("");
      setSinonimos("");
      setEndereco("");
      setCoordsGps(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Field label="Apelido (como aparece nas mensagens)" htmlFor={`${uid}-ap`}>
        <input id={`${uid}-ap`} value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Ex.: Extrativa" autoCapitalize="words" />
      </Field>

      {gpsDisponivel && (
        <button type="button" className="btn ghost block" onClick={usarLocalizacaoAtual} disabled={buscandoGps} style={{ marginBottom: 12 }}>
          {buscandoGps ? <span className="spinner" aria-hidden="true" /> : <Icon name="pin" size={20} />}
          {buscandoGps ? "Pegando sua localização..." : "Usar minha localização atual (GPS)"}
        </button>
      )}

      <Field
        label="Endereço ou coordenadas"
        htmlFor={`${uid}-end`}
        hint={
          coordsGps
            ? "Vindo do GPS do seu celular — pode editar o texto se quiser, mas assim já está exato."
            : "Dica: no Google Maps, segure o dedo no ponto e copie os números que aparecem."
        }
      >
        <input
          id={`${uid}-end`}
          value={endereco}
          onChange={(e) => {
            setEndereco(e.target.value);
            setCoordsGps(null); // editou à mão: volta a valer o texto, não mais o GPS
          }}
          placeholder="Rua, cidade  —  ou  -19.9245, -43.9352"
        />
      </Field>
      {coordsGps && (
        <p className="hint" style={{ marginTop: -10 }}>
          <Icon name="pin" size={14} /> Localização atual capturada pelo GPS.
        </p>
      )}

      <Field label="Outros nomes (separe por vírgula)" htmlFor={`${uid}-sin`}>
        <input id={`${uid}-sin`} value={sinonimos} onChange={(e) => setSinonimos(e.target.value)} placeholder="Ex.: Mina Extrativa, Extrativa Mineral" />
      </Field>
      {erro && <Note tone="loss">{erro}</Note>}
      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn block" onClick={salvar} disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="pin" size={20} />}
          {busy ? "Buscando endereço..." : rotulo}
        </button>
      </div>
    </div>
  );
}
