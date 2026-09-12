import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "check-lint-exceptions.mjs");
// Directive tokens are assembled at runtime so this file never trips the gate itself.
const D = ["eslint", "disable"].join("-");
const C = "/*" + " eslint ";
const Cn = "/*" + "eslint ";
const dirs: string[] = [];
// Fixture flat config: no-console is an error everywhere but the ignored trees.
const config = `export default [
  { ignores: ["contracts/**", "relayer/**", ".next/**"] },
  { files: ["**/*.{js,mjs,cjs,ts}"], rules: { "no-console": "error" } },
];
`;
const LOG = "console.log(1);\n";

function run(files: Record<string, string>, today = "2026-09-11") {
  const dir = mkdtempSync(join(tmpdir(), "lint-exc-"));
  dirs.push(dir);
  writeFileSync(join(dir, "eslint.config.mjs"), config);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  const r = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, LINT_EXCEPTIONS_ROOT: dir, LINT_EXCEPTIONS_TODAY: today },
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("check-lint-exceptions (ESLint-driven)", () => {
  it("passes a dated, unexpired directive and counts it once", () => {
    const r = run({ "lib/a.js": `// ${D}-next-line no-console -- debt; expires 2026-10-31\n${LOG}` });
    expect(r.code).toBe(0);
    expect(r.out).toContain("1 time-bounded exception(s)");
  });

  it("fails an undated directive anywhere ESLint lints (scripts/, config files, nested lib/contracts/)", () => {
    for (const file of ["scripts/tool.mjs", "next.config.mjs", "lib/b.cjs", "app/x/page.js", "lib/contracts/nested.js"]) {
      const r = run({ [file]: `// ${D}-next-line no-console\n${LOG}` });
      expect(r.code, file).toBe(1);
      expect(r.out).toContain("without");
    }
  });

  it("catches every directive form ESLint recognizes, including the no-whitespace cases", () => {
    for (const src of [
      `console.log(1); // ${D}-line no-console\n`,
      `console.log(1)// ${D}-line no-console\n`,
      `const x=1/* ${D} no-console */; console.log(x);\n`,
      `/* ${D} no-console */\n${LOG}`,
      `/* ${D} */\n${LOG}`,
      `/* ${D}-next-line no-console */\n${LOG}`,
    ]) expect(run({ "lib/c.js": src }).code, src).toBe(1);
  });

  it("does not count a directive that suppresses nothing (reportUnusedDisableDirectives owns that case)", () => {
    expect(run({ "lib/n.js": `// ${D}\nexport const n = 1;\n`, "lib/n2.js": `// ${D}-next-line no-alert\nexport const n2 = 2;\n` }).code).toBe(0);
  });

  it("ignores prose and string literals that merely contain the tokens", () => {
    expect(run({
      "lib/d.js": `// note: an ${D} comment needs an expiry\nexport const d = 1;\n`,
      "lib/d2.js": `export const d2 = "; // ${D}-next-line no-console";\n`,
      "lib/d3.js": `export const s = "${C}no-console: off */";\n`,
    }).code).toBe(0);
  });

  it("fails the day after expiry, passes on the day itself, rejects more than 180 days out", () => {
    const f = { "lib/e.js": `// ${D}-next-line no-console -- expires 2026-10-31\n${LOG}` };
    expect(run(f, "2026-10-31").code).toBe(0);
    const late = run(f, "2026-11-01");
    expect(late.code).toBe(1);
    expect(late.out).toContain("expired 2026-10-31");
    const far = run({ "lib/m.js": `// ${D}-next-line no-console -- expires 2099-12-31\n${LOG}` });
    expect(far.code).toBe(1);
    expect(far.out).toContain("more than 180 days");
    expect(run({ "lib/m2.js": `// ${D}-next-line no-console -- expires 2027-03-10\n${LOG}` }).code).toBe(0); // 180 days
    expect(run({ "lib/m3.js": `// ${D}-next-line no-console -- expires 2027-03-11\n${LOG}` }).code).toBe(1); // 181 days
  });

  it("rejects impossible dates in the directive and in TODAY", () => {
    const r = run({ "lib/f.js": `// ${D}-next-line no-console -- expires 2026-99-99\n${LOG}` });
    expect(r.code).toBe(1);
    expect(r.out).toContain("not a real calendar date");
    expect(run({ "lib/g.js": "export const g = 1;\n" }, "2026-02-30").code).toBe(2);
    expect(run({ "lib/h.js": "export const h = 1;\n" }, "2028-02-29").code).toBe(0);
  });

  it("forbids inline ESLint config comments in every form ESLint's parser recognizes", () => {
    for (const src of [
      `${C}no-console: "off" */\n${LOG}`,
      `${C}no-console: ["error", { allow: ["log"] }] */\n${LOG}`,
      `${Cn}no-console:0*/\n${LOG}`,
      `console.log(1); ${C}no-console: off */\n`,
      `/*` + `eslint\n no-console: off */\n${LOG}`,
      `/*\n  ` + `eslint no-console: "off"\n*/\n${LOG}`,
      `/* ` + `exported foo */\nvar foo = 1;\n`,
      `/* ` + `global bar */\nexport const b = bar;\n`,
      `/* ` + `globals baz */\nexport const z = baz;\n`,
      `/* ` + `eslint-env node */\nexport const e = 1;\n`,
    ]) {
      const r = run({ "lib/k.js": src });
      expect(r.code, src).toBe(1);
      expect(r.out).toContain("inline ESLint config comment");
    }
  });

  it("does not mistake a disable or enable directive for a config comment", () => {
    expect(run({
      "lib/k2.js": `/* ${D}-next-line no-console -- expires 2026-10-31 */\n${LOG}`,
      "lib/k3.js": `/* ${D} no-console -- expires 2026-10-31 */\n${LOG}/* eslint-enable no-console */\n`,
    }).code).toBe(0);
  });

  it("respects ESLint's own ignores exactly", () => {
    expect(run({
      "contracts/a.js": `// ${D}\n${LOG}`,
      "relayer/src/b.js": `// ${D}\n${LOG}`,
      ".next/c.js": `// ${D}\n${LOG}`,
    }).code).toBe(0);
  });
});
