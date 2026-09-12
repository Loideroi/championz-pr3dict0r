// Tests for the slither gate (node:test, no extra dependency). Each case writes
// a report + triage pair into a temp dir and runs the script there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(process.cwd(), "scripts", "check-slither.mjs");

function finding(id, check, impact, confidence, file, line, name, extra = {}) {
  return { id, check, impact, confidence, description: `${check} at ${file}#${line}`,
    elements: [{ type: "function", name: "fn", source_mapping: { filename_relative: file, lines: [line - 1, line + 1] } },
               { type: "node", name, source_mapping: { filename_relative: file, lines: [line] } }], ...extra };
}
function entry(f, over = {}) {
  return { id: f.id, check: f.check, slither_impact: f.impact, slither_confidence: f.confidence,
    where: `${f.elements[1].source_mapping.filename_relative}#${f.elements[1].source_mapping.lines[0]}`,
    expression: f.elements[1].name, triaged: "2026-09-12", reason: "reviewed — SECURITY_FINDINGS.md §Slither", ...over };
}
const HIGH = finding("h1", "arbitrary-send-eth", "High", "Medium", "src/A.sol", 10, "to.call{value: v}()");
const MED = finding("m1", "incorrect-equality", "Medium", "High", "src/A.sol", 20, "a == b");
const LOW = finding("l1", "timestamp", "Low", "Medium", "src/A.sol", 30, "block.timestamp");

function run({ report, triage, noReport = false, log }) {
  const dir = mkdtempSync(join(tmpdir(), "slither-gate-"));
  try {
    if (!noReport) writeFileSync(join(dir, "slither-report.json"), JSON.stringify(report));
    writeFileSync(join(dir, "slither-triage.json"), JSON.stringify(triage));
    if (log) writeFileSync(join(dir, "slither.log"), log);
    const r = spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const ok = (detectors) => ({ success: true, error: null, results: { detectors } });

test("clean: every High/Medium triaged, Low informational", () => {
  const r = run({ report: ok([HIGH, MED, LOW]), triage: [entry(HIGH), entry(MED)] });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /2 High\/Medium finding\(s\), all 2 triaged .* 1 lower-severity/);
});
test("no findings at all passes", () => {
  assert.equal(run({ report: ok([]), triage: [] }).code, 0);
});
test("new High finding fails and is named", () => {
  const r = run({ report: ok([HIGH, MED]), triage: [entry(MED)] });
  assert.equal(r.code, 1); assert.match(r.out, /NEW High \(Medium\) arbitrary-send-eth at src\/A.sol#10/);
});
test("new Medium finding fails", () => {
  const r = run({ report: ok([MED]), triage: [] });
  assert.equal(r.code, 1); assert.match(r.out, /NEW Medium/);
});
test("stale entry (id no longer reported) fails", () => {
  const r = run({ report: ok([MED]), triage: [entry(HIGH), entry(MED)] });
  assert.equal(r.code, 1); assert.match(r.out, /stale — no current finding has this id/);
});
test("entry metadata must match the current finding (where, expression, impact, check)", () => {
  for (const over of [{ where: "src/A.sol#11" }, { expression: "x == y" }, { slither_impact: "Low" }, { check: "reentrancy-eth" }, { slither_confidence: "Low" }]) {
    const r = run({ report: ok([MED]), triage: [entry(MED, over)] });
    assert.equal(r.code, 1, JSON.stringify(over)); assert.match(r.out, /but the current finding says/);
  }
});
test("an entry for a Low finding is rejected", () => {
  const r = run({ report: ok([LOW]), triage: [entry(LOW)] });
  assert.equal(r.code, 1); assert.match(r.out, /only High\/Medium findings belong/);
});
test("reviewer fields: missing reason, reason without SECURITY_FINDINGS, bad date, duplicate id, missing id", () => {
  for (const [triage, re] of [
    [[entry(MED, { reason: "" })], /lacks "reason"/],
    [[entry(MED, { reason: "accepted" })], /must cite SECURITY_FINDINGS\.md/],
    [[entry(MED, { triaged: "12/09/2026" })], /triaged must be YYYY-MM-DD/],
    [[entry(MED), entry(MED)], /duplicate id/],
    [[entry(MED, { id: undefined })], /lacks "id"/],
  ]) {
    const r = run({ report: ok([MED]), triage });
    assert.equal(r.code, 1, String(re)); assert.match(r.out, re);
  }
});
test("missing report fails and prints the slither log tail", () => {
  const r = run({ noReport: true, triage: [], log: "Error: Source file requires different compiler version\n" });
  assert.equal(r.code, 1); assert.match(r.out, /slither did not run/); assert.match(r.out, /different compiler version/);
});
test("report with success:false fails even if empty", () => {
  const r = run({ report: { success: false, error: "compilation failed", results: { detectors: [] } }, triage: [] });
  assert.equal(r.code, 1); assert.match(r.out, /slither failed: compilation failed/);
});
test("a finding whose elements lack source mappings still gates", () => {
  const f = { ...HIGH, id: "h2", elements: [{ type: "contract", name: "A" }] };
  const r = run({ report: ok([f]), triage: [] });
  assert.equal(r.code, 1); assert.match(r.out, /NEW High .* at \?/);
});
