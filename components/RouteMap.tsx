"use client";
import { useEffect, useRef } from "react";
import type { MapaDados } from "@/lib/types.ts";

const COR = { POSICAO: "#ffffff", ORIGEM: "#f2b705", DESTINO: "#0b7a4b", BASE: "#8a96a0" } as const;

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
          color: s.tipo === "CHEIO" ? "#16211d" : "#5b6862",
          weight: s.tipo === "CHEIO" ? 6 : 4,
          dashArray: s.tipo === "CHEIO" ? undefined : "2 10",
          lineCap: "round",
        }).addTo(map);
      }
      for (const m of dados.marcadores) {
        L.circleMarker([m.lat, m.lng], {
          radius: 9,
          color: "#16211d",
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
      <div className="kmlab" style={{ marginTop: 6 }}>
        <span>Tracejado: vazio</span>
        <span>Linha grossa: cheio</span>
      </div>
      <p style={{ margin: "10px 0 0" }}>
        <a className="btn linkbtn" href={dados.linkGoogle} target="_blank" rel="noreferrer">
          Abrir no Google Maps
        </a>
      </p>
    </>
  );
}
