import { describe, expect, it } from "vitest";
import { flagEmoji, isValidCountryCode } from "./countries";
import {
  buildProfileMessage,
  containsProfanity,
  isHexAddress,
  isMessageFresh,
  isSupportedChainId,
  parseProfileMessage,
  validateCountry,
  validateUsername,
} from "./validate";

describe("validateUsername", () => {
  it("accepts alphanumeric + underscore, 3–20 chars", () => {
    expect(validateUsername("rikkert")).toBeNull();
    expect(validateUsername("Big_Mac_Bobby_2027")).toBeNull();
    expect(validateUsername("abc")).toBeNull();
    expect(validateUsername("a".repeat(20))).toBeNull();
  });

  it("rejects wrong length", () => {
    expect(validateUsername("ab")).toMatch(/3–20/);
    expect(validateUsername("a".repeat(21))).toMatch(/3–20/);
    expect(validateUsername("")).toMatch(/3–20/);
  });

  it("rejects illegal characters", () => {
    expect(validateUsername("rik kert")).toMatch(/letters, numbers/);
    expect(validateUsername("rik·kert")).toMatch(/letters, numbers/);
    expect(validateUsername("rik-kert")).toMatch(/letters, numbers/);
    expect(validateUsername("émile")).toMatch(/letters, numbers/);
  });

  it("rejects non-strings", () => {
    expect(validateUsername(undefined)).toBe("Username is required.");
    expect(validateUsername(42)).toBe("Username is required.");
  });

  it("rejects profanity, including embedded and leetspeak", () => {
    expect(validateUsername("shithead")).toBe("That username is not allowed.");
    expect(validateUsername("Sh1tLord")).toBe("That username is not allowed.");
    expect(validateUsername("xX_fuck_Xx")).toBe("That username is not allowed.");
  });
});

describe("containsProfanity", () => {
  it("folds leetspeak before matching", () => {
    expect(containsProfanity("sh1t")).toBe(true);
    expect(containsProfanity("b1tch")).toBe(true);
    expect(containsProfanity("n4z1")).toBe(true);
  });

  it("passes clean names", () => {
    expect(containsProfanity("rikkert")).toBe(false);
    expect(containsProfanity("Madrid2027")).toBe(false);
    // "class" style false positives stay allowed — "ass" is not on the list
    expect(containsProfanity("classico_fan")).toBe(false);
  });
});

describe("validateCountry / countries", () => {
  it("accepts known ISO codes", () => {
    expect(validateCountry("NL")).toBeNull();
    expect(validateCountry("BR")).toBeNull();
    expect(isValidCountryCode("MT")).toBe(true);
  });

  it("rejects unknown or malformed codes", () => {
    expect(validateCountry("XX")).toBe("Unknown country code.");
    expect(validateCountry("nl")).toMatch(/two-letter/);
    expect(validateCountry("NLD")).toMatch(/two-letter/);
    expect(validateCountry(undefined)).toMatch(/two-letter/);
  });

  it("derives flag emoji from the code", () => {
    expect(flagEmoji("NL")).toBe("🇳🇱");
    expect(flagEmoji("BR")).toBe("🇧🇷");
    expect(flagEmoji("bad")).toBe("🏳️");
  });
});

describe("profile message round-trip", () => {
  const ts = "2026-07-04T12:00:00.000Z";

  it("builds the human-readable personal_sign message", () => {
    expect(buildProfileMessage("rikkert", "NL", ts)).toBe(
      `₵h@mpi0nz Pr3dict0r profile: rikkert · NL · ${ts}`,
    );
  });

  it("parses its own output", () => {
    const msg = buildProfileMessage("Big_Mac_Bobby", "MT", ts);
    expect(parseProfileMessage(msg)).toEqual({
      username: "Big_Mac_Bobby",
      country: "MT",
      timestampIso: ts,
    });
  });

  it("rejects tampered or malformed messages", () => {
    expect(parseProfileMessage("gimme the pool")).toBeNull();
    expect(parseProfileMessage(`Other dapp profile: rikkert · NL · ${ts}`)).toBeNull();
    expect(parseProfileMessage(undefined)).toBeNull();
  });

  it("enforces freshness with forward-skew tolerance", () => {
    const now = Date.parse(ts);
    expect(isMessageFresh(ts, now)).toBe(true);
    expect(isMessageFresh(ts, now + 9 * 60_000)).toBe(true); // 9 min old
    expect(isMessageFresh(ts, now + 11 * 60_000)).toBe(false); // 11 min old
    expect(isMessageFresh(ts, now - 60_000)).toBe(true); // 1 min ahead (skew)
    expect(isMessageFresh(ts, now - 3 * 60_000)).toBe(false); // 3 min ahead
    expect(isMessageFresh("not-a-date", now)).toBe(false);
  });
});

describe("address / chain guards", () => {
  it("validates hex addresses", () => {
    expect(isHexAddress("0x" + "ab".repeat(20))).toBe(true);
    expect(isHexAddress("0x123")).toBe(false);
    expect(isHexAddress("ab".repeat(21))).toBe(false);
  });

  it("only allows Chiliz chains", () => {
    expect(isSupportedChainId(88882)).toBe(true);
    expect(isSupportedChainId(88888)).toBe(true);
    expect(isSupportedChainId(1)).toBe(false);
    expect(isSupportedChainId("88882")).toBe(false);
  });
});
