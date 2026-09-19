"use client";
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* PWA/compartilhar não fica disponível, mas o resto do site funciona normal */
      });
    }
  }, []);
  return null;
}
