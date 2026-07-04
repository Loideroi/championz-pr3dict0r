/**
 * Username + signed-message validation for the profile API (PRD §13.1).
 * Pure functions — no I/O — so they run identically server-side and in tests.
 */
import { isValidCountryCode } from "./countries";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Small local profanity blocklist (PRD §13.1 "profanity-filtered").
 * Substring match, case-insensitive, with common leetspeak folded first.
 * Deliberately short — this is a tripwire, not a moderation system.
 */
const PROFANITY = [
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "asshole",
  "nigger",
  "nigga",
  "faggot",
  "wanker",
  "dickhead",
  "hitler",
  "nazi",
  "rapist",
  "whore",
  "slut",
] as const;

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
};

function foldLeet(value: string): string {
  return value
    .toLowerCase()
    .replace(/[0134578@$!]/g, (ch) => LEET[ch] ?? ch)
    .replace(/[^a-z]/g, "");
}

/** True when the (folded) username contains a blocklisted word. */
export function containsProfanity(username: string): boolean {
  const folded = foldLeet(username);
  const plain = username.toLowerCase();
  return PROFANITY.some((w) => folded.includes(w) || plain.includes(w));
}

/** Returns an error message, or null when the username is acceptable. */
export function validateUsername(username: unknown): string | null {
  if (typeof username !== "string") return "Username is required.";
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_RE.test(username)) {
    return "Username may only contain letters, numbers and underscores.";
  }
  if (containsProfanity(username)) {
    return "That username is not allowed.";
  }
  return null;
}

/** Returns an error message, or null when the country code is acceptable. */
export function validateCountry(code: unknown): string | null {
  if (typeof code !== "string" || !/^[A-Z]{2}$/.test(code)) {
    return "Country must be a two-letter ISO code.";
  }
  if (!isValidCountryCode(code)) return "Unknown country code.";
  return null;
}

/* ------------------------------------------------------------------ */
/* Signed message                                                      */
/* ------------------------------------------------------------------ */

export const PROFILE_MESSAGE_PREFIX = "₵h@mpi0nz Pr3dict0r profile:";

/** Max age of a signed profile message before it is considered a replay. */
export const MESSAGE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * The human-readable string the wallet signs via personal_sign
 * (Socios wallet supports personal_sign only — never signTypedData).
 */
export function buildProfileMessage(
  username: string,
  country: string,
  timestampIso: string,
): string {
  return `${PROFILE_MESSAGE_PREFIX} ${username} · ${country} · ${timestampIso}`;
}

export type ParsedProfileMessage = {
  username: string;
  country: string;
  timestampIso: string;
};

/** Parse a signed profile message back into its parts; null when malformed. */
export function parseProfileMessage(
  message: unknown,
): ParsedProfileMessage | null {
  if (typeof message !== "string") return null;
  const re = new RegExp(
    `^${PROFILE_MESSAGE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ([A-Za-z0-9_]{3,20}) · ([A-Z]{2}) · (\\S+)$`,
    "u",
  );
  const m = re.exec(message);
  if (!m) return null;
  return { username: m[1], country: m[2], timestampIso: m[3] };
}

/**
 * A message is fresh when its timestamp parses and lies within
 * [now - maxAge, now + 2min] (small forward skew allowed for clock drift).
 */
export function isMessageFresh(
  timestampIso: string,
  nowMs: number,
  maxAgeMs: number = MESSAGE_MAX_AGE_MS,
): boolean {
  const ts = Date.parse(timestampIso);
  if (Number.isNaN(ts)) return false;
  return ts >= nowMs - maxAgeMs && ts <= nowMs + 2 * 60 * 1000;
}

/** True for a 0x-prefixed 20-byte hex address. */
export function isHexAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Chains the predictor runs on: Chiliz Spicy staging + mainnet. */
export const SUPPORTED_CHAIN_IDS = [88882, 88888] as const;

export function isSupportedChainId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    (SUPPORTED_CHAIN_IDS as readonly number[]).includes(value)
  );
}
