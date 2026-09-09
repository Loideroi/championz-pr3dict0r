"use client";

import type { ReactNode } from "react";
import { formatUtc } from "@/lib/admin/health";
import { explorerTxUrl, isOverdue, pushLatencyMinutes, type MatchPipeline } from "@/lib/admin/pipeline";

type Props = {
  match: { id: number; kickoff: number; status: number };
  pipeline: MatchPipeline | undefined;
  chainId: number;
  /** Wall clock at the last refresh (ms); 0 while nothing has loaded. */
  nowMs: number;
};

/** Per-match column of the admin table: what the bot did for this fixture and when. */
export function PipelineCell({ match: m, pipeline: p, chainId, nowMs }: Props) {
  const link = (hash: string | null, text: string) => {
    const url = explorerTxUrl(chainId, hash); // null unless a real 32-byte hash
    return url ? (
      <a href={url} target="_blank" rel="noreferrer" className="underline decoration-dotted">
        {text} ↗
      </a>
    ) : (
      <span>{text}</span>
    );
  };

  const parts: ReactNode[] = [];
  if (p?.pushedAt) {
    const lat = pushLatencyMinutes(m.kickoff, p.pushedAt);
    parts.push(
      <span key="push" className="text-ok">
        {link(p.pushTx, `pushed ${formatUtc(p.pushedAt)}${lat !== null ? ` (+${lat}′)` : ""}`)}
      </span>,
    );
  } else if (m.status === 1) {
    parts.push(
      <span key="nolog" className="text-muted">
        completed · no push row (pre-#75 or manual)
      </span>,
    );
  } else if (nowMs && isOverdue(m.kickoff, false, Math.floor(nowMs / 1000))) {
    parts.push(
      <span key="overdue" className="text-star">
        ⚠ overdue — no result 2h after kickoff
      </span>,
    );
  }
  if (p && p.corrections > 0) {
    parts.push(
      <span key="corr" className="text-star">
        {link(p.correctionTx, `corrected ×${p.corrections}`)}
      </span>,
    );
  }
  if (p && p.reminders.length > 0) {
    parts.push(
      <span key="rem" className="text-muted">
        ⏰ {p.reminders.map((r) => (r === "t75_reminder" ? "last call" : "heads-up")).join(", ")}
      </span>,
    );
  }
  if (parts.length === 0) return <span className="text-muted">—</span>;
  return <div className="flex flex-col gap-0.5">{parts}</div>;
}
