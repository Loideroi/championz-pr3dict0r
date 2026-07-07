"use client";

/**
 * Sign-up / profile form (PRD §13.1): after wallet connect the user picks a
 * username + country, signs one human-readable message via personal_sign
 * (Socios.com Wallet supports personal_sign only — never signTypedData) and
 * POSTs it to /api/profile, where the dual EOA / ERC-1271 path verifies it.
 *
 * SSR-safe: no Date.now()/random in render — timestamps are built inside the
 * submit handler only.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useChainId, useReadContract, useSignMessage } from "wagmi";
import {
  PREDICTOR_ABI,
  PREDICTOR_ADDRESS,
  STAGE_KNOCKOUT,
  STAGE_LEAGUE,
} from "@/lib/predictor/abi";
import { countryName, flagEmoji } from "@/lib/profile/countries";
import { buildProfileMessage, validateUsername } from "@/lib/profile/validate";
import { CountrySelect } from "./CountrySelect";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;

type SavedProfile = {
  username: string;
  countryCode: string;
  entryTier: "full_season" | "knockout" | null;
  updatedAt: string;
};

export function ProfileForm() {
  const t = useTranslations("profile.form");
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();

  const [username, setUsername] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const enteredLeague = useReadContract({
    ...contract,
    functionName: "entered",
    args: address ? [STAGE_LEAGUE, address] : undefined,
    query: { enabled: !!address && !!PREDICTOR_ADDRESS },
  });
  const enteredKnockout = useReadContract({
    ...contract,
    functionName: "entered",
    args: address ? [STAGE_KNOCKOUT, address] : undefined,
    query: { enabled: !!address && !!PREDICTOR_ADDRESS },
  });

  const entryTierLabel = !PREDICTOR_ADDRESS
    ? "—"
    : enteredLeague.data
      ? t("tierSeason")
      : enteredKnockout.data
        ? t("tierKnockout")
        : enteredLeague.isLoading || enteredKnockout.isLoading
          ? "…"
          : t("tierNone");

  // Stake gate (mirrors the server: usernames are for entrants only). Only
  // trips once both reads have settled to a confident "no entry".
  const notEntered =
    !!PREDICTOR_ADDRESS &&
    enteredLeague.isFetched &&
    enteredKnockout.isFetched &&
    !enteredLeague.data &&
    !enteredKnockout.data;

  const loadProfile = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(
        `/api/profile?address=${address}&chainId=${chainId}`,
      );
      if (!res.ok) {
        setSaved(null);
        return;
      }
      const json = (await res.json()) as { profile: SavedProfile | null };
      if (json.profile) {
        setSaved(json.profile);
        setUsername(json.profile.username);
        setCountry(json.profile.countryCode);
      }
    } catch {
      /* offline / not configured — the form still renders */
    }
  }, [address, chainId]);

  useEffect(() => {
    // Deferred: no sync setState in the effect body (react-hooks rule).
    const t = setTimeout(() => {
      setSaved(null);
      setNotice(null);
      if (address) void loadProfile();
    }, 0);
    return () => clearTimeout(t);
  }, [address, loadProfile]);

  async function submit() {
    if (!address || !country) return;
    const usernameError = validateUsername(username);
    if (usernameError) {
      setNotice({ kind: "err", text: usernameError });
      return;
    }
    setBusy(true);
    setNotice(null);

    // Phase 1 — signing. With the Socios.com Wallet (SCW over WalletConnect)
    // the user can approve in the wallet app yet the relayed response never
    // reaches this promise (mobile app-switch drops the socket). Distinguish
    // that from a real rejection and tell the user a plain retry will work —
    // no funds or state are at risk, the signature is free to redo.
    // Human-readable message; timestamp built here (event handler — SSR-safe).
    const message = buildProfileMessage(
      username,
      country,
      new Date().toISOString(),
    );
    let signature: `0x${string}`;
    try {
      setNotice({ kind: "ok", text: t("checkWallet") });
      signature = await signMessageAsync({ message });
    } catch (err) {
      const raw =
        (err as { shortMessage?: string; message?: string })?.shortMessage ??
        (err as { message?: string })?.message ??
        "";
      const rejected = /reject|denied|cancel/i.test(raw);
      setNotice({
        kind: "err",
        text: rejected ? t("sigFailed") : t("sigDropped"),
      });
      setBusy(false);
      return;
    }

    // Phase 2 — saving. Server errors come back as JSON and are shown as-is;
    // only a network-level failure lands in the catch.
    try {
      setNotice({ kind: "ok", text: t("saving") });
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          chainId,
          username,
          country,
          message,
          signature,
        }),
      });
      const json = (await res.json()) as {
        profile?: SavedProfile;
        error?: string;
      };
      if (!res.ok) {
        setNotice({
          kind: "err",
          text: json.error ?? t("saveFailed", { status: res.status }),
        });
        return;
      }
      if (json.profile) setSaved(json.profile);
      setNotice({
        kind: "ok",
        text: t("saved"),
      });
    } catch {
      setNotice({ kind: "err", text: t("saveNetwork") });
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-line bg-night-2/60 p-6">
        <p className="text-sm text-muted">{t("connectPrompt")}</p>
        <button
          type="button"
          onClick={() => open()}
          className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-3 font-semibold text-white"
        >
          {t("connectWallet")}
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-line bg-night-2/60 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-mono text-xs text-muted-2">{address}</p>
        <p className="shrink-0 rounded-full border border-line px-3 py-1 font-mono text-xs uppercase tracking-widest text-glow-2">
          {entryTierLabel}
        </p>
      </div>

      {saved && (
        <p className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 font-mono text-sm text-ok">
          <span aria-hidden>{flagEmoji(saved.countryCode)}</span>{" "}
          {t("savedLine", {
            username: saved.username,
            country: countryName(saved.countryCode),
          })}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor="clp-username"
          className="font-mono text-xs uppercase tracking-widest text-muted"
        >
          {t("usernameLabel")}
        </label>
        <input
          id="clp-username"
          type="text"
          value={username}
          disabled={busy || notEntered}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("usernamePlaceholder")}
          maxLength={20}
          autoComplete="off"
          className="rounded-xl border border-line bg-night-3/60 px-4 py-3 text-sm text-ink placeholder:text-muted-2 focus:border-glow-2 focus:outline-none disabled:opacity-40"
        />
        <p className="font-mono text-xs text-muted-2">{t("usernameHint")}</p>
      </div>

      <CountrySelect value={country} onChange={setCountry} disabled={busy || notEntered} />

      {notEntered && (
        <p className="rounded-xl border border-star/40 bg-star/10 px-4 py-3 font-mono text-xs text-star">
          {t("stakeFirst")}{" "}
          <a href="/enter" className="underline underline-offset-4">
            {t("stakeFirstCta")}
          </a>
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !username || !country || notEntered}
        className="rounded-xl bg-gradient-to-b from-glow-2 to-glow px-5 py-3 font-semibold text-white disabled:opacity-40"
      >
        {busy ? t("waiting") : saved ? t("update") : t("signSave")}
      </button>

      <p className="font-mono text-xs text-muted-2">{t("signNote")}</p>

      {notice && (
        <p
          role="status"
          className={`font-mono text-xs ${notice.kind === "ok" ? "text-ok" : "text-chz-2"}`}
        >
          {notice.text}
        </p>
      )}
    </form>
  );
}
