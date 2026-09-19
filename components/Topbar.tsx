"use client";
import Link from "next/link";
import { Logo } from "@/components/Icons";
import { useAuth } from "@/lib/auth";

export function Topbar() {
  const { user, disponivel } = useAuth();
  const sincronizado = disponivel && !!user;
  const texto = sincronizado ? "Sincronizado" : disponivel ? "Só neste aparelho" : "Modo local";
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="FreteMax — início">
        <Logo />
        <span>
          Frete<b>Max</b>
        </span>
      </Link>
      <Link href="/conta" className={`sync ${sincronizado ? "on" : ""}`}>
        <i />
        {texto}
      </Link>
    </header>
  );
}
