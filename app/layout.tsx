import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Topbar } from "@/components/Topbar";
import { PwaRegister } from "@/components/PwaRegister";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AuthProvider } from "@/lib/auth";
import { SessaoProvider } from "@/lib/sessao";

const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--f-body" });
const num = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--f-num" });

export const metadata: Metadata = {
  title: "FreteMax",
  description: "Descubra qual carga realmente vale a pena.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FreteMax" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0b100f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${num.variable}`}>
      <body>
        <AuthProvider>
          <SessaoProvider>
            <OfflineBanner />
            <Topbar />
            <main className="wrap">{children}</main>
            <Nav />
          </SessaoProvider>
        </AuthProvider>
        <PwaRegister />
      </body>
    </html>
  );
}

