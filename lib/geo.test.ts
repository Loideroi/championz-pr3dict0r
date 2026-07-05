import { describe, expect, it } from "vitest";
import { BLOCKED_COUNTRIES, isBlocked } from "../middleware";

describe("geo-fencing (ADR-0007)", () => {
  it("blocks exactly the 14 Fanbet jurisdictions, case-insensitively", () => {
    expect(BLOCKED_COUNTRIES).toHaveLength(14);
    for (const c of BLOCKED_COUNTRIES) {
      expect(isBlocked(c)).toBe(true);
      expect(isBlocked(c.toLowerCase())).toBe(true);
    }
  });

  it("allows everyone else and unknown geo (defence-in-depth over the T&C clause)", () => {
    for (const c of ["NL", "GB", "US", "ES", "BR", "TR", "DE", "FR"]) {
      expect(isBlocked(c)).toBe(false);
    }
    expect(isBlocked(null)).toBe(false); // absent header → allow
  });
});
