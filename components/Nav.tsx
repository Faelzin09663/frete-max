"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", label: "Cargas" },
  { href: "/locais", label: "Locais" },
  { href: "/caminhao", label: "Caminhão" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Principal">
      <div className="nav-in">
        {ITENS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={path === i.href ? "page" : undefined}>
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
