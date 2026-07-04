/**
 * Ops alerting (slice 06, PRD §8.3): Telegram DM to the admin + private ops
 * channel. The transport is injected so tests never touch the network, and a
 * missing token degrades to console output (GitHub Actions failure e-mail
 * stays the second wire).
 */
export type AlertKind = 'SOURCE_SCHEMA_CHANGED' | 'SOURCE_STALE' | 'RELAY_ERRORS';

export interface Alert {
  kind: AlertKind;
  summary: string;
  detail?: string | undefined;
}

export interface RunStats {
  pushed: number[];
  corrected: number[];
  skippedCount: number;
  errorCount: number;
  trackedMatches: number;
  sourceId: string;
}

export interface TelegramTransport {
  send(text: string): Promise<boolean>;
}

const RUNBOOK = 'https://github.com/Loideroi/championz-pr3dict0r/blob/main/.scratch/championz-predictor/issues/06-breakage-detection-ops-alerts.md';

export function composeAlert(alert: Alert): string {
  const icon =
    alert.kind === 'SOURCE_SCHEMA_CHANGED' ? '🚨' : alert.kind === 'SOURCE_STALE' ? '⏰' : '❌';
  return [
    `${icon} <b>${alert.kind}</b>`,
    alert.summary,
    alert.detail ? `<pre>${escapeHtml(alert.detail.slice(0, 600))}</pre>` : null,
    `Runbook: ${RUNBOOK}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** The daily "silence is detectable" message (PRD §8.3). */
export function composeHeartbeat(stats: RunStats): string {
  return [
    '✅ <b>oracle healthy</b>',
    `${stats.trackedMatches} matches tracked · source ${stats.sourceId}`,
    `last run: pushed ${stats.pushed.length} · corrected ${stats.corrected.length} · skipped ${stats.skippedCount} · errors ${stats.errorCount}`,
  ].join('\n');
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function telegramTransport(botToken: string | undefined, chatId: string | undefined): TelegramTransport {
  return {
    async send(text: string): Promise<boolean> {
      if (!botToken || !chatId) {
        console.error('[alert not delivered — TELEGRAM env missing]\n' + text);
        return false;
      }
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      if (!res.ok) console.error(`telegram sendMessage failed: HTTP ${res.status}`);
      return res.ok;
    },
  };
}
