"use client";

/**
 * Mobile install banner (ported from the World Cup predictor): Android gets
 * the native install prompt, iOS links to the /ios-install walkthrough
 * (which also handles the Socios.com in-app browser case). Hidden on desktop,
 * when already installed, and after a dismiss (localStorage).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISS_KEY = "clp-install-banner-dismissed";

export function InstallBanner() {
  const t = useTranslations("pwa");
  const { isInstallable, isIOS, isStandalone, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true); // SSR-safe default: hidden

  useEffect(() => {
    // Deferred: no sync setState in the effect body (react-hooks rule).
    const t = setTimeout(() => {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const show = !dismissed && !isStandalone && (isInstallable || isIOS);
  if (!show) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    // Only shows < lg, where max-w-5xl never binds — side margins do the work.
    <div className="mx-4 mb-4 mt-8 flex items-center gap-3 rounded-2xl border border-line bg-night-2/80 px-4 py-3 lg:hidden">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-glow-2 to-glow text-white"
      >
        ★
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{t("bannerTitle")}</p>
        <p className="truncate font-mono text-xs text-muted">{t("bannerSubtitle")}</p>
      </div>
      {isInstallable ? (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="shrink-0 rounded-xl bg-gradient-to-b from-glow-2 to-glow px-4 py-2 text-sm font-semibold text-white"
        >
          {t("install")}
        </button>
      ) : (
        <Link
          href="/ios-install"
          className="shrink-0 rounded-xl bg-gradient-to-b from-glow-2 to-glow px-4 py-2 text-sm font-semibold text-white"
        >
          {t("howToInstall")}
        </Link>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="shrink-0 rounded-lg px-2 py-1 text-muted hover:bg-white/5 hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
