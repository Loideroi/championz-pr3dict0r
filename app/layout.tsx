import type { Metadata } from "next";
import { Archivo, Inter, Space_Mono } from "next/font/google";
import { Providers } from "./providers";
import { HealthBanner } from "@/components/chrome/HealthBanner";
import { SiteNav } from "@/components/chrome/SiteNav";
import { Starfield } from "@/components/chrome/Starfield";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "₵h@mpi0nz Pr3dict0r — Champions League predictions on Chiliz",
  description:
    "Stake CHZ, predict the 90-minute scorelines of the UEFA Champions League 2026/27, climb the leaderboards from matchday one to Madrid.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-night text-ink font-body">
        <Starfield />
        <Providers>
          <SiteNav />
          <HealthBanner />
          <div className="flex-1 flex flex-col">{children}</div>
        </Providers>
        <footer className="border-t border-line-soft py-6 text-center font-mono text-xs text-muted-2">
          Design inspired by BigMac Bobby · Built on Chiliz Chain · Not
          affiliated with or endorsed by UEFA
        </footer>
      </body>
    </html>
  );
}
