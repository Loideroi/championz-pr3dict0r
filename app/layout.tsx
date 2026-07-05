import type { Metadata } from "next";
import { Archivo, Inter, Space_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("layout.metadata");
  return {
    title: t("title"),
    description: t("description"),
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
  const t = await getTranslations("layout");

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
          </Providers>
          <footer className="border-t border-line-soft py-6 text-center font-mono text-xs text-muted-2">
            {t("footer")}
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
