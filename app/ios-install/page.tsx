"use client";

/**
 * iOS PWA install walkthrough (ported from the World Cup predictor).
 *
 * Three states:
 *  - Socios.com app / any in-app webview (no full Safari UA) → PWAs can't
 *    install from a webview, so show "open in Safari first" with a copyable
 *    URL instead of steps that can't work.
 *  - iOS 26+ Safari → the share button moved into the "…" menu.
 *  - Older iOS Safari → the classic bottom-bar share-sheet flow.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const SITE_URL = "pr3dict0r.com";

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-line bg-night-2/60 p-5">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-b from-glow-2 to-glow font-display text-sm font-black text-white"
      >
        {n}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{desc}</p>
      </div>
    </li>
  );
}

export default function IosInstallPage() {
  const t = useTranslations("iosInstall");
  const { isIOS, iosVersion, isSafari, isStandalone } = usePWAInstall();
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`https://${SITE_URL}`);
      setCopied(true);
    } catch {
      /* clipboard unavailable in some webviews — the URL is shown as text */
    }
  };

  const modern = (iosVersion ?? 0) >= 26;
  const suffix = modern ? "26" : "Legacy";
  const showWebviewCard = isIOS && !isSafari;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        {t("tagline")}
      </p>
      <h1 className="text-center font-display text-4xl font-black uppercase tracking-tight">
        {t("heading")}
      </h1>

      {isStandalone && (
        <p className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 font-mono text-sm text-ok">
          {t("alreadyInstalled")}
        </p>
      )}

      {showWebviewCard && (
        <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-star/40 bg-star/10 p-5">
          <p className="font-semibold text-star">{t("openInSafariFirst")}</p>
          <p className="text-sm text-muted">{t("webviewMessage")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl border border-line bg-night-3/60 px-4 py-3 font-mono text-sm">
              {SITE_URL}
            </code>
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="rounded-xl bg-gradient-to-b from-glow-2 to-glow px-4 py-3 text-sm font-semibold text-white"
            >
              {copied ? t("copied") : t("copyButton")}
            </button>
          </div>
          <p className="font-mono text-xs text-muted-2">{t("copyUrlInstruction")}</p>
        </div>
      )}

      {!showWebviewCard && (
        <ol className="flex w-full max-w-md flex-col gap-3">
          <Step n={1} title={t(`step1Title${suffix}`)} desc={t(`step1Desc${suffix}`)} />
          <Step n={2} title={t(`step2Title${suffix}`)} desc={t(`step2Desc${suffix}`)} />
          <Step n={3} title={t(`step3Title${suffix}`)} desc={t(`step3Desc${suffix}`)} />
          <Step n={4} title={t(`step4Title${suffix}`)} desc={t(`step4Desc${suffix}`)} />
        </ol>
      )}

      {!isIOS && !showWebviewCard && (
        <p className="max-w-md text-center font-mono text-xs text-muted-2">
          {t("notIOS")}
        </p>
      )}
    </main>
  );
}
