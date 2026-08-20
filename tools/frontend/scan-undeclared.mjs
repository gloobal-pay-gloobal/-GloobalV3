// Finds identifiers referenced in the built bundle that are never declared
// anywhere in it and are not known globals. In this project every module
// shares one scope, so such a reference is a guaranteed runtime ReferenceError.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../../gloobal-essentials-preview/", import.meta.url)));  // paths below are relative to the preview project root

// esbuild and rollup are devDependencies of gloobal-essentials-preview, not of
// the repo root where this script now lives. A static `import` resolves from
// this file's own directory, which has no node_modules, so they are required
// through the preview project's package.json instead — the same createRequire
// the rest of this script already uses to reach react/react-dom.
const require_ = createRequire(new URL("../../gloobal-essentials-preview/package.json", import.meta.url));
const { parseAst } = require_("rollup/parseAst");
const { transformSync } = require_("esbuild");

// Relative to the preview project root this chdir'd into above — the same
// `./src/GloobalApp.jsx` the probe scripts read. This was an absolute
// "D:/gloobal-new version/..." path, which only ever worked on one machine
// with one folder name, and broke the moment the checkout was renamed.
const FILE = "./src/GloobalApp.jsx";
const src = readFileSync(FILE, "utf8");
const js = transformSync(src, { loader: "jsx", format: "esm", target: "es2022" }).code;
const ast = parseAst(js);

const declared = new Set();
const referenced = new Map(); // name -> count

function declPattern(node) {
  if (!node) return;
  switch (node.type) {
    case "Identifier": declared.add(node.name); break;
    case "ObjectPattern": node.properties.forEach((p) => declPattern(p.type === "RestElement" ? p.argument : p.value)); break;
    case "ArrayPattern": node.elements.forEach(declPattern); break;
    case "AssignmentPattern": declPattern(node.left); break;
    case "RestElement": declPattern(node.argument); break;
  }
}

const SKIP_KEYS = new Set(["loc", "start", "end", "range", "type"]);

function walk(node, parent) {
  if (!node || typeof node.type !== "string") return;

  switch (node.type) {
    case "VariableDeclarator": declPattern(node.id); break;
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      if (node.id) declared.add(node.id.name);
      node.params.forEach(declPattern);
      break;
    case "ClassDeclaration":
    case "ClassExpression":
      if (node.id) declared.add(node.id.name);
      break;
    case "CatchClause": declPattern(node.param); break;
    case "ImportDefaultSpecifier":
    case "ImportNamespaceSpecifier":
    case "ImportSpecifier":
      declared.add(node.local.name);
      return; // don't walk `imported` — it is a module export name, not a reference
    case "Identifier": {
      // Only count real value references.
      if (parent) {
        if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return;
        if (parent.type === "Property" && parent.key === node && !parent.computed) return;
        if (parent.type === "MethodDefinition" && parent.key === node && !parent.computed) return;
        if (parent.type === "PropertyDefinition" && parent.key === node && !parent.computed) return;
        if (parent.type === "ExportSpecifier") return;
        if (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement") return;
      }
      referenced.set(node.name, (referenced.get(node.name) || 0) + 1);
      return;
    }
  }

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && walk(c, node));
    else if (v && typeof v.type === "string") walk(v, node);
  }
}

walk(ast, null);

const GLOBALS = new Set([
  "undefined", "NaN", "Infinity", "globalThis", "console", "window", "document", "navigator",
  "location", "history", "localStorage", "sessionStorage", "fetch", "Math", "JSON", "Date",
  "Object", "Array", "String", "Number", "Boolean", "Symbol", "Promise", "Map", "Set", "WeakMap",
  "WeakSet", "Error", "TypeError", "RangeError", "RegExp", "Intl", "BigInt", "Proxy", "Reflect",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
  "cancelAnimationFrame", "queueMicrotask", "structuredClone", "crypto", "performance",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent",
  "atob", "btoa", "alert", "confirm", "prompt", "URL", "URLSearchParams", "Blob", "File",
  "FileReader", "FormData", "Headers", "Request", "Response", "AbortController", "Image",
  "Uint8Array", "Uint8ClampedArray", "Int8Array", "Uint16Array", "Int16Array", "Uint32Array",
  "Int32Array", "Float32Array", "Float64Array", "ArrayBuffer", "DataView", "TextEncoder",
  "TextDecoder", "MutationObserver", "IntersectionObserver", "ResizeObserver", "CustomEvent",
  "Event", "EventTarget", "MessageChannel", "Worker", "SVGElement", "HTMLElement", "Node",
  "process", "module", "require", "exports", "__dirname", "arguments", "this", "super",
  // esbuild rewrites `import.meta` into a shim when it targets CJS for the
  // probe build, which surfaces here as a bare `import` identifier. Vite
  // substitutes the real `import.meta.env.VITE_*` reads at build time.
  "import",
]);

const missing = [...referenced.entries()]
  .filter(([n]) => !declared.has(n) && !GLOBALS.has(n))
  .sort((a, b) => b[1] - a[1]);

console.log("declared bindings:", declared.size, "| distinct references:", referenced.size);
if (missing.length === 0) {
  console.log("No undeclared references.");
} else {
  console.log("\nUNDECLARED REFERENCES (guaranteed ReferenceError when reached):");
  for (const [name, count] of missing) {
    const line = src.split("\n").findIndex((l) => new RegExp("\\b" + name + "\\b").test(l)) + 1;
    console.log(`  ${name}  — ${count} use(s), first around generated line ${line}`);
  }
}
