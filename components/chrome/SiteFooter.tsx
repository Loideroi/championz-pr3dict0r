"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useReadContract } from "wagmi";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS } from "@/lib/predictor/abi";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "88882");
const EXPLORER =
  CHAIN_ID === 88888 ? "https://chiliscan.com" : "https://testnet.chiliscan.com";

const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Site footer: T&Cs link + the two on-chain trust anchors (verified predictor
 * contract + the oracle address it trusts, read live from the contract), and
 * the UEFA non-affiliation line. Addresses deep-link to the block explorer.
 */
export function SiteFooter() {
  const t = useTranslations("layout");
  const oracle = useReadContract({
    address: PREDICTOR_ADDRESS,
    abi: PREDICTOR_ABI,
    functionName: "oracle",
    query: { enabled: !!PREDICTOR_ADDRESS },
  });

  return (
    <footer className="flex flex-col gap-2 border-t border-line-soft py-6 text-center font-mono text-xs text-muted-2">
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4">
        <Link href="/terms" className="underline decoration-line underline-offset-4 hover:text-ink">
          {t("terms")}
        </Link>
        {PREDICTOR_ADDRESS && (
          <>
            <span aria-hidden>·</span>
            <a
              href={`${EXPLORER}/address/${PREDICTOR_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-line underline-offset-4 hover:text-ink"
            >
              {t("contract")}: {shorten(PREDICTOR_ADDRESS)} ✓
            </a>
          </>
        )}
        {oracle.data && (
          <>
            <span aria-hidden>·</span>
            <a
              href={`${EXPLORER}/address/${oracle.data}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-line underline-offset-4 hover:text-ink"
            >
              {t("oracle")}: {shorten(oracle.data)}
            </a>
          </>
        )}
      </nav>
      <p className="px-4">{t("footer")}</p>
    </footer>
  );
}
