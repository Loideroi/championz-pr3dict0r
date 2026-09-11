import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "check-lint-exceptions.mjs");
// Built at runtime so this file never contains the literal directive token the checker scans for.
const D = ["eslint", "disable"].join("-");
const dirs: string[] = [];

function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "lint-exc-"));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

function run(dir: string, today = "2026-09-11") {
  const r = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, LINT_EXCEPTIONS_ROOT: dir, LINT_EXCEPTIONS_TODAY: today },
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("check-lint-exceptions", () => {
  it("passes a dated, unexpired directive and counts it", () => {
    const dir = fixture({ "lib/a.ts": `// ${D}-next-line complexity -- debt; expires 2026-10-31\nexport const a = 1;\n` });
    const r = run(dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("1 time-bounded exception(s)");
  });

  it("fails an undated directive anywhere ESLint lints, including scripts/ and config files", () => {
    for (const file of ["scripts/tool.mjs", "next.config.ts", "lib/b.cjs", "app/x/page.tsx"]) {
      const dir = fixture({ [file]: `// ${D}-next-line no-console\nconsole.log(1);\n` });
      const r = run(dir);
      expect(r.code, file).toBe(1);
      expect(r.out).toContain('without "expires YYYY-MM-DD"');
    }
  });

  it("catches every directive form", () => {
    for (const line of [
      `// ${D}-line no-console`,
      `/* ${D} no-console */`,
      `/* ${D} */`,
      `// ${D}`,
    ]) {
      const dir = fixture({ "lib/c.ts": `${line}\nexport const c = 1;\n` });
      expect(run(dir).code, line).toBe(1);
    }
  });

  it("ignores prose that merely mentions the word, and directives inside string literals", () => {
    const dir = fixture({
      "lib/d.ts": `// note: an ${D} comment needs an expiry\nexport const d = 1;\n`,
      "lib/d2.ts": `export const d2 = "// ${D}-next-line no-console";\n`,
    });
    expect(run(dir).code).toBe(0);
  });

  it(`counts an inline ${D}-line after code`, () => {
    const dir = fixture({ "lib/i.ts": `console.log(1); // ${D}-line no-console\n` });
    expect(run(dir).code).toBe(1);
  });

  it("fails the day after expiry and passes on the day itself", () => {
    const dir = fixture({ "lib/e.ts": `// ${D}-next-line complexity -- expires 2026-10-31\nexport const e = 1;\n` });
    expect(run(dir, "2026-10-31").code).toBe(0);
    const late = run(dir, "2026-11-01");
    expect(late.code).toBe(1);
    expect(late.out).toContain("expired 2026-10-31");
  });

  it("rejects impossible dates in the directive and in TODAY", () => {
    const dir = fixture({ "lib/f.ts": `// ${D}-next-line complexity -- expires 2026-99-99\nexport const f = 1;\n` });
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("not a real calendar date");
    expect(run(fixture({ "lib/g.ts": "export const g = 1;\n" }), "2026-02-30").code).toBe(2);
    expect(run(fixture({ "lib/h.ts": "export const h = 1;\n" }), "2028-02-29").code).toBe(0);
  });

  it("skips the ESLint-ignored trees", () => {
    const dir = fixture({
      "node_modules/x/index.js": `// ${D}\n`,
      "contracts/a.ts": `// ${D}\n`,
      "relayer/src/b.ts": `// ${D}\n`,
      ".next/c.js": `// ${D}\n`,
    });
    expect(run(dir).code).toBe(0);
  });
});
