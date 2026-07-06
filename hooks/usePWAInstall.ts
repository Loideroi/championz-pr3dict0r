"use client";

/**
 * PWA install detection — ported from the World Cup predictor's proven hook.
 *
 * Three signals drive the install UX:
 *  - Android/Chrome fires `beforeinstallprompt` → we can trigger the native
 *    install sheet directly.
 *  - iOS never fires it → users go through Safari's share-sheet, and the
 *    steps differ between iOS 26+ and older versions.
 *  - The Socios.com app's in-app browser (WKWebView) can't install PWAs at
 *    all → detect it and tell the user to open the site in Safari first.
 *
 * SSR-safe: everything runs inside useEffect; render never touches
 * navigator/window.
 */
import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectIOS(): boolean {
  const ua = navigator.userAgent;
  // iPhone/iPad/iPod are always present in iOS user agents (Safari + webviews).
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ desktop mode reports as Mac — fall back to touch-point count.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

function detectSafari(): boolean {
  const ua = navigator.userAgent;
  // True Safari carries "Version/X.Y … Safari/"; other iOS browsers rebrand
  // (CriOS/FxiOS/…), and in-app webviews (Socios.com is a WKWebView) lack the
  // full "Version/… Safari/" pattern.
  const hasSafari = /Safari\//.test(ua);
  const isOtherBrowser = /CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  const isFullSafari = /Version\/[\d.]+ .*Safari\//.test(ua);
  return hasSafari && !isOtherBrowser && isFullSafari;
}

function getIOSVersion(): number | null {
  const ua = navigator.userAgent;
  // iOS 26+ freezes the OS token at 18.6, but the Safari Version/ token is
  // accurate — check it first.
  const safariVersion = ua.match(/Version\/(\d+)\.\d+.*Safari/);
  if (safariVersion && parseInt(safariVersion[1], 10) >= 26) {
    return parseInt(safariVersion[1], 10);
  }
  // Webviews (Socios.com app) expose Version/ without the Safari suffix.
  const bareVersion = ua.match(/Version\/(\d+)\.\d+/);
  if (bareVersion && parseInt(bareVersion[1], 10) >= 26) {
    return parseInt(bareVersion[1], 10);
  }
  const os = ua.match(/OS (\d+)[_.]/);
  return os ? parseInt(os[1], 10) : null;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [iosVersion, setIOSVersion] = useState<number | null>(null);
  const [isSafari, setIsSafari] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Deferred: no sync setState in the effect body (react-hooks rule).
    const t = setTimeout(() => {
      setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
      const iOS = detectIOS();
      setIsIOS(iOS);
      if (iOS) {
        setIOSVersion(getIOSVersion());
        setIsSafari(detectSafari());
      }
    }, 0);
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstallable(false);
      return true;
    }
    return false;
  }, [installPrompt]);

  return { isInstallable, isIOS, iosVersion, isSafari, isStandalone, promptInstall };
}
