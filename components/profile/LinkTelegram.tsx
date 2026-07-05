"use client";

import { useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";

/**
 * Opt-in Telegram linking (slice 10, PRD §12): sign → one-time deep link →
 * press Start in Telegram → linked. One-tap unlink. Strictly optional.
 */
export function LinkTelegram({ linkedHandle }: { linkedHandle?: string | null }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [linked, setLinked] = useState(Boolean(linkedHandle));

  async function signed(): Promise<{ message: string; signature: string } | null> {
    if (!address) return null;
    const msg = `₵h@mpi0nz Pr3dict0r telegram-link: ${address.toLowerCase()} · ${chainId} · ${new Date().toISOString()}`;
    try {
      const signature = await signMessageAsync({ message: msg }); // personal_sign — SCW-safe
      return { message: msg, signature };
    } catch {
      setMessage("Signature declined.");
      return null;
    }
  }

  async function handleLink() {
    setBusy(true);
    setMessage("");
    const sig = await signed();
    if (sig && address) {
      const res = await fetch("/api/telegram/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, chainId, ...sig }),
      });
      const json = await res.json();
      if (res.ok) {
        setDeepLink(json.deepLink);
        setMessage("Open the link and press START — the code lives 15 minutes.");
      } else {
        setMessage(json.error ?? "Linking failed.");
      }
    }
    setBusy(false);
  }

  async function handleUnlink() {
    setBusy(true);
    setMessage("");
    const sig = await signed();
    if (sig && address) {
      const res = await fetch("/api/telegram/link", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, chainId, ...sig }),
      });
      if (res.ok) {
        setLinked(false);
        setDeepLink(null);
        setMessage("Unlinked — the bot forgets you entirely.");
      } else {
        setMessage("Unlink failed.");
      }
    }
    setBusy(false);
  }

  if (!isConnected) return null;

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-line bg-night-2/60 p-5">
      <p className="font-mono text-xs uppercase tracking-widest text-glow-2">Telegram (optional)</p>
      <p className="text-sm text-muted">
        Link your Telegram to get lock reminders and the community group invite. Opt-in,
        one-tap unlink, never required.
      </p>
      {linked ? (
        <button
          type="button"
          disabled={busy}
          onClick={handleUnlink}
          className="rounded-xl border border-line px-4 py-2 font-semibold text-ink disabled:opacity-50"
        >
          {busy ? "Working…" : "Unlink Telegram"}
        </button>
      ) : deepLink ? (
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-gradient-to-b from-glow-2 to-glow px-4 py-2 text-center font-semibold text-white"
        >
          Open Telegram & press START →
        </a>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={handleLink}
          className="rounded-xl bg-gradient-to-b from-glow-2 to-glow px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Waiting for signature…" : "Link Telegram"}
        </button>
      )}
      {message && <p className="font-mono text-xs text-muted">{message}</p>}
    </div>
  );
}
