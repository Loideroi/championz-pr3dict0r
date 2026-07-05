/**
 * /api/telegram/webhook — the bot's inbound handler (slice 10). Registered
 * via setWebhook with a secret_token once the app is deployed (issue 16);
 * until then relayer/scripts/bot-poll.mjs long-polls the same logic.
 *
 * Handles `/start <code>` → consumes the one-time link code, stores
 * telegram_user_id/handle on the profile, replies, and (when
 * TELEGRAM_GROUP_ID is set) sends a one-person group invite link.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { consumeLinkCode, LINK_CODES_TABLE } from "@/lib/telegram/link";
import { PROFILES_TABLE } from "@/lib/profile/service";
import type { LinkDb } from "@/lib/telegram/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function linkDb(): LinkDb | null {
  const sb = getServiceRoleClient();
  if (!sb) return null;
  return {
    async insertCode() {
      return { error: "not used here" };
    },
    async findCode(code) {
      const { data } = await sb
        .from(LINK_CODES_TABLE)
        .select("wallet_address, chain_id, expires_at")
        .eq("code", code)
        .maybeSingle();
      return data ?? null;
    },
    async deleteCode(code) {
      await sb.from(LINK_CODES_TABLE).delete().eq("code", code);
    },
    async setTelegram(wallet, chainId, tg) {
      const { error } = await sb
        .from(PROFILES_TABLE)
        .update(tg)
        .eq("wallet_address", wallet)
        .eq("chain_id", chainId);
      return error ? { error: error.message } : {};
    },
  };
}

async function reply(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function groupInvite(): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const group = process.env.TELEGRAM_GROUP_ID;
  if (!token || !group) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/createChatInviteLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: group, member_limit: 1 }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { invite_link?: string } };
  return json.result?.invite_link ?? null;
}

export async function POST(request: NextRequest) {
  // Telegram authenticates webhooks via this header (setWebhook secret_token)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const update = (await request.json()) as {
    message?: { chat?: { id: number }; from?: { id: number; username?: string }; text?: string };
  };
  const msg = update.message;
  const text = msg?.text ?? "";
  const chatId = msg?.chat?.id;
  if (!msg || !chatId) return NextResponse.json({ ok: true });

  const startMatch = text.match(/^\/start(?:\s+([0-9a-f]{20}))?/);
  if (!startMatch) return NextResponse.json({ ok: true });

  const code = startMatch[1];
  if (!code) {
    await reply(
      chatId,
      "👋 This is the ₵h@mpi0nz Pr3dict0r bot. To link your wallet, use the “Link Telegram” button on your profile at https://pr3dict0r.com/profile — it brings you back here with a one-time code.",
    );
    return NextResponse.json({ ok: true });
  }

  const db = linkDb();
  if (!db) return NextResponse.json({ ok: true });
  const result = await consumeLinkCode(
    db,
    code,
    { userId: String(msg.from?.id ?? chatId), handle: msg.from?.username ?? null },
    Date.now(),
  );
  if (!result.ok) {
    await reply(
      chatId,
      result.reason === "expired"
        ? "⏰ That link code expired (they live 15 minutes). Generate a fresh one from your profile."
        : "🤔 That code doesn't work — generate a fresh one from your profile.",
    );
    return NextResponse.json({ ok: true });
  }
  const invite = await groupInvite();
  await reply(
    chatId,
    `✅ Linked to <code>${result.wallet.slice(0, 6)}…${result.wallet.slice(-4)}</code>. You'll get the good stuff here.` +
      (invite ? `\n\nJoin the community group: ${invite}` : ""),
  );
  return NextResponse.json({ ok: true });
}
