// Live connectivity check against the real Gloobal backend on Render
// (Express + MongoDB Atlas). Exercises the ported client in
// backend/services/api/ exactly as the browser will.
//
// READ-ONLY. Every call here is a GET or a lookup — nothing in this file
// creates, updates, or deletes a record. Do not add OTP sends, registration
// or transaction calls: those write to the shared prototype database.
//
//   cd gloobal-essentials-preview && node tools/check-backend.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createRequire } from "node:module";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const require_ = createRequire(new URL("../package.json", import.meta.url));

const SRC = "./src/GloobalApp.jsx";
const TMP_SRC = "./_backend_check.jsx";
const TMP_OUT = "./_backend_check.cjs";

const base = readFileSync(SRC, "utf8");
writeIf(TMP_SRC, base + "\nexport { GloobalApi, GLOOBAL_API_BASE };\n");

function writeIf(p, c) {
  return require_("node:fs").writeFileSync(p, c);
}

await build({
  entryPoints: [TMP_SRC],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: TMP_OUT,
  loader: { ".jsx": "jsx" },
  external: ["react", "react-dom"],
  logLevel: "error"
});

// localStorage is only touched by the session helpers, which this check
// does not call — but the module reads `window` at import time in places,
// so give it a minimal stand-in.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  }
};

const { GloobalApi, GLOOBAL_API_BASE } = require_(TMP_OUT);

console.log(`base URL: ${GLOOBAL_API_BASE}`);
console.log("Render free tier sleeps when idle — the first call can take 20-50s.\n");

let failures = 0;
async function check(label, fn, expect) {
  const started = Date.now();
  try {
    const value = await fn();
    const ms = Date.now() - started;
    const verdict = expect ? expect(value) : true;
    if (verdict === true) {
      console.log(`  ok    ${label}  (${ms}ms)`);
    } else {
      failures++;
      console.log(`  FAIL  ${label}  (${ms}ms) — ${verdict}`);
      console.log(`        got: ${JSON.stringify(value).slice(0, 200)}`);
    }
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${label}  (${Date.now() - started}ms)`);
    console.log(`        ${err.name}: ${err.message}`);
  }
}

// An ID that is valid in shape (12 symbols from the Gloobal alphabet) but
// vanishingly unlikely to be registered — proves the round trip reaches
// Mongo and gets a real "no such user" answer rather than a transport error.
//
// Generated fresh each run rather than hardcoded: the first version of this
// check used "■■■■■■■■■■■■" and failed, because that is a real registered
// account. 8^12 ≈ 6.9e10 combinations, so a random one is safe.
const GLOOBAL_SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const UNUSED_ID = Array.from({ length: 12 }, () => GLOOBAL_SYMBOLS[Math.floor(Math.random() * 8)]).join("");

console.log("Connectivity");
await check("warm up (fire and forget)", async () => {
  GloobalApi.warmUp();
  return "sent";
});

console.log("\nLookup — reaches MongoDB and answers");
// GET /api/users/resolve is signed-in only. It answers with a real name, a
// mobile number and a cashback rate, and it accepts a phone number as the
// identifier, so leaving it open made it a directory of the platform's users
// and a phone-number-to-account oracle. This runs with no token, so the only
// correct answer is 401 — and asserting that is what keeps the route from
// quietly becoming public again.
//
// This check used to expect the 404 "no registered user" message, from back
// when the route was unauthenticated. It has been failing ever since the route
// was closed, against a backend that was behaving exactly as intended.
await check(
  "resolveUser(unregistered) is refused without a token",
  async () => {
    try {
      await GloobalApi.resolveUser(UNUSED_ID);
      return { status: "RESOLVED (unexpected)" };
    } catch (err) {
      return { status: err.status, message: err.message };
    }
  },
  (v) => (v.status === 401 ? true : `expected HTTP 401, got ${JSON.stringify(v)}`)
);

await check(
  "checkSymbolAvailability(unregistered) === available",
  () => GloobalApi.checkSymbolAvailability(UNUSED_ID),
  (v) => (v.available === true ? true : `expected available:true, got available:${v.available}`)
);

await check(
  "referralCodeExists(unregistered) === false",
  () => GloobalApi.referralCodeExists(UNUSED_ID),
  (v) => (v === false ? true : `expected false, got ${JSON.stringify(v)}`)
);

console.log("\nError shape");
await check(
  "getProfile(unregistered) raises a typed error, not a crash",
  async () => {
    try {
      const p = await GloobalApi.getProfile(UNUSED_ID);
      return { resolved: p };
    } catch (err) {
      return { name: err.name, status: err.status };
    }
  },
  (v) => (v.name === "GloobalApiError" || v.resolved ? true : `unexpected: ${JSON.stringify(v)}`)
);

try {
  const fs = require_("node:fs");
  fs.unlinkSync(TMP_SRC);
  fs.unlinkSync(TMP_OUT);
} catch {}

console.log(failures === 0 ? "\nBackend reachable and answering correctly." : `\n${failures} check(s) failed.`);
process.exit(failures ? 1 : 0);
