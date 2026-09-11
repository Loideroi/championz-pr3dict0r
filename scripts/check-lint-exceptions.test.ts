import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "check-lint-exceptions.mjs");
// Built at runtime so this file never contains the literal directive token.
const D = ["eslint", "disable"].join("-");
// Likewise the inline-config opener (block comment + "eslint" + space) is assembled at runtime.
const C = "/*" + " eslint ";
const Cn = "/*" + "eslint ";
const dirs: string[] = [];

// Minimal flat config for fixtures: no-console is an error everywhere except
// the ESLint-ignored trees, mirroring the repo's globalIgnores shape.
const config = `export default [
  { ignores: ["contracts/**", "relayer/**", ".next/**"] },
  { files: ["**/*.{js,mjs,cjs,ts}"], rules: { "no-console": "error" } },
];
`;

function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "lint-exc-"));
  dirs.push(dir);
  writeFileSync(join(dir, "eslint.config.mjs"), config);
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

describe("check-lint-exceptions (ESLint-driven)", () => {
  it("passes a dated, unexpired directive and counts it once", () => {
    const dir = fixture({ "lib/a.js": `// ${D}-next-line no-console -- debt; expires 2026-10-31\nconsole.log(1);\n` });
    const r = run(dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("1 time-bounded exception(s)");
  });

  it("fails an undated directive anywhere ESLint lints, including scripts/, config files and nested lib/contracts/", () => {
    for (const file of ["scripts/tool.mjs", "next.config.mjs", "lib/b.cjs", "app/x/page.js", "lib/contracts/nested.js"]) {
      const dir = fixture({ [file]: `// ${D}-next-line no-console\nconsole.log(1);\n` });
      const r = run(dir);
      expect(r.code, file).toBe(1);
      expect(r.out).toContain("without");
    }
  });

  it("catches every directive form ESLint recognizes, including the no-whitespace cases", () => {
    for (const src of [
      `console.log(1); // ${D}-line no-console\n`,
      `console.log(1)// ${D}-line no-console\n`,
      `const x=1/* ${D} no-console */; console.log(x);\n`,
      `/* ${D} no-console */\nconsole.log(1);\n`,
      `/* ${D} */\nconsole.log(1);\n`,
      `/* ${D}-next-line no-console */\nconsole.log(1);\n`,
    ]) {
      const dir = fixture({ "lib/c.js": src });
      expect(run(dir).code, src).toBe(1);
    }
  });

  it("does not count a directive that suppresses nothing (ESLint's unused-directive error owns that case)", () => {
    // `// eslint-disable` as a LINE comment is not a directive ESLint recognizes;
    // a disable naming a rule that is off suppresses nothing. Neither is an
    // exception, so neither needs an expiry here; reportUnusedDisableDirectives
    // rejects the second in `npm run lint`.
    const dir = fixture({ "lib/n.js": `// ${D}\nexport const n = 1;\n`, "lib/n2.js": `// ${D}-next-line no-alert\nexport const n2 = 2;\n` });
    expect(run(dir).code).toBe(0);
  });

  it("ignores prose and string literals that merely contain the token", () => {
    const dir = fixture({
      "lib/d.js": `// note: an ${D} comment needs an expiry\nexport const d = 1;\n`,
      "lib/d2.js": `export const d2 = "; // ${D}-next-line no-console";\n`,
    });
    expect(run(dir).code).toBe(0);
  });

  it("fails the day after expiry and passes on the day itself", () => {
    const dir = fixture({ "lib/e.js": `// ${D}-next-line no-console -- expires 2026-10-31\nconsole.log(1);\n` });
    expect(run(dir, "2026-10-31").code).toBe(0);
    const late = run(dir, "2026-11-01");
    expect(late.code).toBe(1);
    expect(late.out).toContain("expired 2026-10-31");
  });

  it("rejects impossible dates in the directive and in TODAY", () => {
    const dir = fixture({ "lib/f.js": `// ${D}-next-line no-console -- expires 2026-99-99\nconsole.log(1);\n` });
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("not a real calendar date");
    expect(run(fixture({ "lib/g.js": "export const g = 1;\n" }), "2026-02-30").code).toBe(2);
    expect(run(fixture({ "lib/h.js": "export const h = 1;\n" }), "2028-02-29").code).toBe(0);
  });

  it("forbids inline ESLint config comments, which bypass suppression tracking", () => {
    for (const src of [
      `${C}no-console: "off" */\nconsole.log(1);\n`,
      `${C}no-console: ["error", { allow: ["log"] }] */\nconsole.log(1);\n`,
      `${Cn}no-console:0*/\nconsole.log(1);\n`,
    ]) {
      const dir = fixture({ "lib/k.js": src });
      const r = run(dir);
      expect(r.code, src).toBe(1);
      expect(r.out).toContain("inline ESLint config comment");
    }
    // a disable directive is not a config comment
    const ok = fixture({ "lib/k2.js": `/* ${D}-next-line no-console -- expires 2026-10-31 */\nconsole.log(1);\n` });
    expect(run(ok).code).toBe(0);
  });

  it("rejects an expiry more than 180 days out", () => {
    const far = fixture({ "lib/m.js": `// ${D}-next-line no-console -- expires 2099-12-31\nconsole.log(1);\n` });
    const r = run(far);
    expect(r.code).toBe(1);
    expect(r.out).toContain("more than 180 days");
    expect(run(fixture({ "lib/m2.js": `// ${D}-next-line no-console -- expires 2027-03-10\nconsole.log(1);\n` })).code).toBe(0); // 180 days
    expect(run(fixture({ "lib/m3.js": `// ${D}-next-line no-console -- expires 2027-03-11\nconsole.log(1);\n` })).code).toBe(1); // 181 days
  });

  it("respects ESLint's own ignores exactly", () => {
    const dir = fixture({
      "contracts/a.js": `// ${D}\nconsole.log(1);\n`,
      "relayer/src/b.js": `// ${D}\nconsole.log(1);\n`,
      ".next/c.js": `// ${D}\nconsole.log(1);\n`,
    });
    expect(run(dir).code).toBe(0);
  });
});
