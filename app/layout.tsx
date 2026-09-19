import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Nav } from "@/components/Nav";

const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--f-body" });
const num = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--f-num" });

export const metadata: Metadata = {
  title: "FreteMax",
  description: "Descubra qual carga realmente vale a pena.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#16211d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${num.variable}`}>
      <body>
        <main className="wrap">{children}</main>
        <Nav />
      </body>
    </html>
  );
}
