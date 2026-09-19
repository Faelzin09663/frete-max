"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icons";

const ITENS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Cargas", icon: "cargas" },
  { href: "/viagens", label: "Painel", icon: "painel" },
  { href: "/locais", label: "Locais", icon: "pin" },
  { href: "/caminhao", label: "Caminhão", icon: "truck" },
  { href: "/conta", label: "Conta", icon: "user" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="dock" aria-label="Principal">
      {ITENS.map((i) => {
        const ativo = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={ativo ? "page" : undefined}>
            <Icon name={i.icon} size={23} />
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
