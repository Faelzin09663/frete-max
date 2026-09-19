"use client";
import { useEffect, useRef } from "react";
import type { MapaDados } from "@/lib/types.ts";

const COR = { POSICAO: "#ffffff", ORIGEM: "#ffb800", DESTINO: "#0a9b5e", BASE: "#8a96a0" } as const;

export function RouteMap({ dados }: { dados: MapaDados }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelado = false;

    (async () => {
      const mod = await import("leaflet");
      const L: typeof import("leaflet") = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod;
      if (cancelado || !ref.current) return;

      map = L.map(ref.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const todos: [number, number][] = [];
      for (const s of dados.segmentos) {
        todos.push(...s.pontos);
        L.polyline(s.pontos, {
          color: s.tipo === "CHEIO" ? "#111716" : "#5d6966",
          weight: s.tipo === "CHEIO" ? 6 : 4,
          dashArray: s.tipo === "CHEIO" ? undefined : "2 10",
          lineCap: "round",
        }).addTo(map);
      }
      for (const m of dados.marcadores) {
        L.circleMarker([m.lat, m.lng], {
          radius: 9,
          color: "#111716",
          weight: 3,
          fillColor: COR[m.papel],
          fillOpacity: 1,
        })
          .bindTooltip(m.nome, { permanent: true, direction: "top", offset: [0, -8] })
          .addTo(map);
        todos.push([m.lat, m.lng]);
      }
      map.fitBounds(L.latLngBounds(todos), { padding: [30, 30] });
    })();

    return () => {
      cancelado = true;
      map?.remove();
    };
  }, [dados]);

  return (
    <>
      <div ref={ref} className="map" role="img" aria-label="Mapa da rota" />
      <div className="roadlab" style={{ marginTop: 8 }}>
        <span>
          <i className="v" />
          Tracejado: vazio
        </span>
        <span>
          <i />
          Linha grossa: cheio
        </span>
      </div>
      <div className="maplink">
        <a className="btn ghost block" href={dados.linkGoogle} target="_blank" rel="noreferrer">
          Abrir no Google Maps
        </a>
      </div>
    </>
  );
}
