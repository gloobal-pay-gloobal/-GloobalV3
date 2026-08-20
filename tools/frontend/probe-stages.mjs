// Renders GloobalId at each registration stage by patching the initial
// `stage` state in a throwaway copy of the generated bundle. The real
// source files are never touched.
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";

import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../../gloobal-essentials-preview/", import.meta.url)));  // paths below are relative to the preview project root

const require_ = createRequire(new URL("../../gloobal-essentials-preview/package.json", import.meta.url));
// esbuild and rollup are devDependencies of gloobal-essentials-preview, not of
// the repo root where this script now lives. A static `import` resolves from
// this file's own directory, which has no node_modules, so they are required
// through the preview project's package.json instead — the same createRequire
// the rest of this script already uses to reach react/react-dom.
const { build } = require_("esbuild");
const GEN = "./src/GloobalApp.jsx";
const STAGES = ["phone", "otp", "secureId", "referral", "profile", "pin", "biometric", "dashboard", "loginAuth", "loginBiometric"];

const base = readFileSync(GEN, "utf8");
const STAGE_INIT = /const \[stage, setStage\] = useState(\d*)\("phone"\);/;
if (!STAGE_INIT.test(base)) { console.error("could not find the stage useState initialiser"); process.exit(2); }

// ---- browser stubs -----------------------------------------------------
const store = new Map();
const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.localStorage = storage;
globalThis.sessionStorage = storage;
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.window = {
  innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, localStorage: storage, sessionStorage: storage,
  matchMedia: globalThis.matchMedia, addEventListener() {}, removeEventListener() {}, scrollTo() {},
  requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame: () => {},
  navigator: { userAgent: "node", clipboard: { writeText: async () => {} } },
  history: { pushState() {}, back() {} }, location: { href: "http://localhost/" },
};
try { Object.defineProperty(globalThis, "navigator", { value: globalThis.window.navigator, configurable: true }); } catch {}
globalThis.document = {
  documentElement: { style: {}, classList: { add() {}, remove() {} } },
  body: { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, removeChild() {} },
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {}, classList: { add() {}, remove() {} } }),
  addEventListener() {}, removeEventListener() {}, querySelector: () => null, getElementById: () => null,
  head: { appendChild() {}, removeChild() {} },
};

const React = require_("react");
const { renderToString } = require_("react-dom/server");

const origLog = console.log;
let failures = 0;

for (const stage of STAGES) {
  const srcFile = `./_stage_${stage}.jsx`;
  const outFile = `./_stage_${stage}.cjs`;
  const patched = base
    .replace(STAGE_INIT, (m, n) => `const [stage, setStage] = useState${n}(${JSON.stringify(stage)});`)
    // SSR-only: useSyncExternalStore needs a server snapshot. Reuse the
    // client getSnapshot — this is a probe artifact, not an app change.
    .replace(/useSyncExternalStore(\w*)\(subscribe, getSnapshot\)/g, "useSyncExternalStore$1(subscribe, getSnapshot, getSnapshot)");
  writeFileSync(srcFile, patched + `\nexport { GloobalId, LedgerProvider };\n`);
  await build({ entryPoints: [srcFile], bundle: true, format: "cjs", platform: "node", outfile: outFile, loader: { ".jsx": "jsx" }, external: ["react", "react-dom"], logLevel: "error" });

  const mod = require_(outFile);
  store.clear();
  console.log = () => {}; // silence the app's own domain-event logging
  let result;
  try {
    const html = renderToString(React.createElement(mod.LedgerProvider, null, React.createElement(mod.GloobalId, null)));
    result = { ok: true, len: html.length };
  } catch (e) {
    result = { ok: false, e };
  }
  console.log = origLog;

  if (result.ok) {
    console.log(`OK    stage="${stage}"  (${result.len} chars)`);
  } else {
    failures++;
    const e = result.e;
    console.log(`FAIL  stage="${stage}"`);
    console.log(`      ${e.constructor.name}: ${e.message}`);
    console.log(String(e.stack).split("\n").slice(1, 4).map((l) => "      " + l.trim()).join("\n"));
  }
  try { unlinkSync(srcFile); unlinkSync(outFile); } catch {}
}

console.log(`\n${STAGES.length - failures}/${STAGES.length} stages render.`);
process.exit(failures ? 1 : 0);
