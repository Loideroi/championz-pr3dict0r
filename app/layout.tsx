import type { Metadata } from "next";
import { Archivo, Inter, Space_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "./providers";
import { HealthBanner } from "@/components/chrome/HealthBanner";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteNav } from "@/components/chrome/SiteNav";
import { Starfield } from "@/components/chrome/Starfield";
import { InstallBanner } from "@/components/pwa/InstallBanner";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("layout.metadata");
  return {
    metadataBase: new URL("https://pr3dict0r.com"),
    title: t("title"),
    description: t("description"),
    // Reputation/crawl signals: explicit indexing consent + rich previews so
    // Google, link unfurlers and wallet-security scanners see a legitimate,
    // well-described site rather than an anonymous crypto domain.
    robots: { index: true, follow: true },
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "https://pr3dict0r.com",
      siteName: "₵h@mpi0nz Pr3dict0r",
      title: t("title"),
      description: t("description"),
      images: [{ url: "/icon-512.png", width: 512, height: 512 }],
    },
    twitter: {
      card: "summary",
      title: t("title"),
      description: t("description"),
      images: ["/icon-512.png"],
    },
    manifest: "/manifest.webmanifest",
    icons: {
      // Safari ignores SVG favicons — list the raster .ico first (it also
      // lives at /favicon.ico via the file convention) and let SVG-capable
      // browsers upgrade to the crisp vector.
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.svg", type: "image/svg+xml" },
      ],
      shortcut: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Pr3dict0r",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Active locale comes from the NEXT_LOCALE cookie (i18n/request.ts) — same
  // value server and client, so <html lang> and the messages never mismatch.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${archivo.variable} ${inter.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-night text-ink font-body">
        <NextIntlClientProvider>
          <Starfield />
          <Providers>
            <SiteNav />
            <HealthBanner />
            <div className="flex-1 flex flex-col">{children}</div>
            <InstallBanner />
            <SiteFooter />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
