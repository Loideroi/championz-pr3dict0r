"use client";

import { useTranslations } from "next-intl";
import { useReadContract } from "wagmi";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS } from "@/lib/predictor/abi";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "88882");
const EXPLORER =
  CHAIN_ID === 88888 ? "https://chiliscan.com" : "https://testnet.chiliscan.com";

const shorten = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

function TrustRow({
  label,
  address,
  note,
}: {
  label: string;
  address: string;
  note: string;
}) {
  return (
    <a
      href={`${EXPLORER}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-line bg-night-3/40 px-4 py-3 text-left transition-colors hover:border-glow-2/60"
    >
      <span
        aria-hidden="true"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ok/50 bg-ok/15 text-xs text-ok"
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          {label}
        </span>
        <span className="block truncate font-mono text-sm text-ink group-hover:text-glow-2">
          {shorten(address)}
        </span>
        <span className="block font-mono text-[10px] text-muted-2">{note}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-muted group-hover:text-glow-2">
        ↗
      </span>
    </a>
  );
}

/**
 * Homepage trust box: the predictor contract (source-verified) and its
 * results oracle (read live from the contract — chain is truth), each with a
 * verified tick and a deep link to the Chiliz Chain explorer.
 */
export function TrustBox() {
  const t = useTranslations("trust");
  const oracle = useReadContract({
    address: PREDICTOR_ADDRESS,
    abi: PREDICTOR_ABI,
    functionName: "oracle",
    query: { enabled: !!PREDICTOR_ADDRESS },
  });

  if (!PREDICTOR_ADDRESS) return null;

  return (
    <section
      aria-label={t("title")}
      className="w-full max-w-2xl rounded-2xl border border-line bg-night-2/60 p-5 text-left"
    >
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-glow-2">
        {t("title")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <TrustRow
          label={t("contract")}
          address={PREDICTOR_ADDRESS}
          note={t("contractNote")}
        />
        {oracle.data && (
          <TrustRow
            label={t("oracle")}
            address={oracle.data}
            note={t("oracleNote")}
          />
        )}
      </div>
    </section>
  );
}
