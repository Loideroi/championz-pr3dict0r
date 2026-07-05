#!/usr/bin/env node
/**
 * i18n parity gate (slice 14, D10).
 *
 * Asserts two invariants across the six message files:
 *  1. Key parity — every locale has the exact same set of (deeply nested) keys
 *     as the English source. A missing or extra key fails the build, so a
 *     translator can never silently drop a string (no runtime missing-key
 *     warning slips to production).
 *  2. Non-translatable tokens — certain substrings are byte-identical facts
 *     (currency ticker, entry prices, the BigMac Bobby credit). Every token
 *     present in en.json must appear in every other locale, so a well-meaning
 *     translation can never localise "CHZ" into "FCH" or round 1,100 to 1.100.
 *
 * Run: `npm run check:i18n` (also wired into CI's `app` job).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(HERE, "..", "messages");

const LOCALES = ["en", "es", "fr", "it", "pt-BR", "tr"];
const SOURCE = "en";

/**
 * Substrings that must survive translation verbatim in every locale. These are
 * facts, not prose: the currency ticker, the two entry prices (grouped exactly
 * as en formats them), and the design credit.
 */
const NON_TRANSLATABLE_TOKENS = ["CHZ", "1,100", "550", "BigMac Bobby"];

function load(locale) {
  const path = join(MESSAGES_DIR, `${locale}.json`);
  return { path, json: JSON.parse(readFileSync(path, "utf8")), raw: readFileSync(path, "utf8") };
}

/** Collect every leaf key path (dot-joined) from a nested messages object. */
function keyPaths(obj, prefix = "") {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out.push(...keyPaths(value, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};

const source = load(SOURCE);
const sourceKeys = new Set(keyPaths(source.json));

console.log(`i18n parity — source: ${SOURCE}.json (${sourceKeys.size} keys)`);

for (const locale of LOCALES) {
  if (locale === SOURCE) continue;
  const { json, raw } = load(locale);
  const keys = new Set(keyPaths(json));

  // 1. key parity (both directions)
  const missing = [...sourceKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !sourceKeys.has(k));
  if (missing.length) fail(`${locale}: missing ${missing.length} key(s): ${missing.join(", ")}`);
  if (extra.length) fail(`${locale}: ${extra.length} extra key(s): ${extra.join(", ")}`);

  // 2. non-translatable tokens present in en must be present here too
  for (const token of NON_TRANSLATABLE_TOKENS) {
    if (source.raw.includes(token) && !raw.includes(token)) {
      fail(`${locale}: non-translatable token "${token}" is missing`);
    }
  }

  if (!missing.length && !extra.length) console.log(`  ✓ ${locale}: ${keys.size} keys`);
}

if (failures > 0) {
  console.error(`\ni18n parity FAILED (${failures} problem${failures === 1 ? "" : "s"}).`);
  process.exit(1);
}
console.log("\ni18n parity OK — all locales aligned.");
