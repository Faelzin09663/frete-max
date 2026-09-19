"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);

    // Check initial state
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="alert">
      <Icon name="wifi-off" size={18} />
      <span>Sem internet. A leitura da IA e as rotas precisam de conexão.</span>
    </div>
  );
}
