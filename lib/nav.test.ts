import { describe, expect, it } from "vitest";
import { isActivePath, MOBILE_NAV_LINKS } from "./nav";

describe("isActivePath", () => {
  it("matches the section exactly", () => {
    expect(isActivePath("/play", "/play")).toBe(true);
    expect(isActivePath("/standings", "/play")).toBe(false);
  });

  it("matches nested routes under a section", () => {
    expect(isActivePath("/play/md1", "/play")).toBe(true);
    expect(isActivePath("/hall-of-fame/2027", "/hall-of-fame")).toBe(true);
  });

  it("does not treat a prefix collision as the same section", () => {
    // "/playground" must NOT light up "/play"
    expect(isActivePath("/playground", "/play")).toBe(false);
  });

  it("home highlights nothing (the brand mark owns it) and null is safe", () => {
    for (const l of MOBILE_NAV_LINKS) expect(isActivePath("/", l.href)).toBe(false);
    expect(isActivePath(null, "/play")).toBe(false);
  });
});

describe("MOBILE_NAV_LINKS", () => {
  it("covers every top-level section once, with a short label key each", () => {
    expect(MOBILE_NAV_LINKS.map((l) => l.href)).toEqual([
      "/enter",
      "/play",
      "/standings",
      "/hall-of-fame",
      "/profile",
    ]);
    for (const l of MOBILE_NAV_LINKS) expect(l.shortKey).toBe(`short.${l.key}`);
  });
});
