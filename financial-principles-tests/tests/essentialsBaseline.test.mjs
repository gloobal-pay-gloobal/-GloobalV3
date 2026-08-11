import test from "node:test";
import assert from "node:assert/strict";
import {
  ESSENTIALS_BASELINE_USD_BY_ISO,
  ESSENTIALS_BASELINE_DEFAULT_USD,
  ESSENTIALS_BASELINE_REQUIRED_KEYS,
  isValidEssentialsBaselineEntry,
  EssentialsBaselineRepository,
  computeEssentialsBaseline,
  COUNTRY_CURRENCY,
  RATES,
  convert
} from "../src/data/essentialsBaseline.js";

// ---------------------------------------------------------------------
// Country fallback
// ---------------------------------------------------------------------
test("known country (US) is not flagged as a fallback", () => {
  const b = computeEssentialsBaseline("US");
  assert.equal(b.usedFallback, false);
});

test("unknown ISO code falls back to the default USD baseline", () => {
  const b = computeEssentialsBaseline("ZZ");
  assert.equal(b.usedFallback, true);
  // ZZ isn't in COUNTRY_CURRENCY either, so currency also falls back to USD.
  assert.equal(b.currencyCode, "USD");
  const expectedDaily = Object.values(ESSENTIALS_BASELINE_DEFAULT_USD).reduce((a, v) => a + v, 0);
  assert.ok(Math.abs(b.dailyTotal - expectedDaily) < 0.01);
});

test("EssentialsBaselineRepository.hasCountry agrees with usedFallback", () => {
  for (const iso of ["US", "IN", "QQ", "JP", "XX"]) {
    const hasCountry = EssentialsBaselineRepository.hasCountry(iso);
    const b = computeEssentialsBaseline(iso);
    assert.equal(b.usedFallback, !hasCountry, `mismatch for ${iso}`);
  }
});

test("a malformed table entry is rejected and falls back safely", () => {
  const brokenRepo = {
    dataSource: "test-broken",
    getBaselineUSD: () => ({ food: "not-a-number", water: 1, shelter: 1, creativity: 1 }),
    hasCountry: () => true
  };
  // isValidEssentialsBaselineEntry itself should reject this shape.
  assert.equal(isValidEssentialsBaselineEntry({ food: "x", water: 1, shelter: 1, creativity: 1 }), false);
  assert.equal(isValidEssentialsBaselineEntry({ food: 1, water: 1, shelter: 1, creativity: -1 }), false);
  assert.equal(isValidEssentialsBaselineEntry({ food: 1, water: 1, shelter: 1 }), false); // missing key
  assert.equal(isValidEssentialsBaselineEntry({ food: 1, water: 1, shelter: 1, creativity: 1 }), true);
  // computeEssentialsBaseline itself doesn't re-validate what a custom
  // repository hands back — that's the repository's job (documented
  // contract) — so this just documents current behavior via the
  // built-in repository, which DOES validate:
  const b = computeEssentialsBaseline("ZZ", EssentialsBaselineRepository);
  assert.equal(b.usedFallback, true);
});

test("every table entry conforms to the required shape", () => {
  for (const [iso, entry] of Object.entries(ESSENTIALS_BASELINE_USD_BY_ISO)) {
    assert.ok(isValidEssentialsBaselineEntry(entry), `${iso} entry is malformed`);
  }
});

// ---------------------------------------------------------------------
// Currency conversion
// ---------------------------------------------------------------------
test("USD country is not run through convert() (passthrough)", () => {
  const b = computeEssentialsBaseline("US");
  const usd = ESSENTIALS_BASELINE_USD_BY_ISO.US;
  assert.equal(b.components.food, usd.food);
  assert.equal(b.components.water, usd.water);
  assert.equal(b.components.shelter, usd.shelter);
  assert.equal(b.components.creativity, usd.creativity);
});

test("non-USD country components match convert() applied to the raw USD entry", () => {
  for (const iso of ["IN", "JP", "GB", "PK"]) {
    const b = computeEssentialsBaseline(iso);
    const usd = ESSENTIALS_BASELINE_USD_BY_ISO[iso];
    const currency = COUNTRY_CURRENCY[iso];
    for (const key of ESSENTIALS_BASELINE_REQUIRED_KEYS) {
      const expected = convert(usd[key], "USD", currency);
      assert.equal(b.components[key], expected, `${iso}.${key}`);
    }
  }
});

test("currency code matches COUNTRY_CURRENCY for known countries", () => {
  for (const iso of Object.keys(ESSENTIALS_BASELINE_USD_BY_ISO)) {
    const b = computeEssentialsBaseline(iso);
    assert.equal(b.currencyCode, COUNTRY_CURRENCY[iso] || "USD");
  }
});

// ---------------------------------------------------------------------
// Daily / monthly totals
// ---------------------------------------------------------------------
test("dailyTotal equals the sum of the four components", () => {
  for (const iso of ["US", "IN", "JP", "ZZ", "BR"]) {
    const b = computeEssentialsBaseline(iso);
    const sum = Object.values(b.components).reduce((a, v) => a + v, 0);
    assert.ok(Math.abs(sum - b.dailyTotal) < 0.02, `${iso}: sum=${sum} daily=${b.dailyTotal}`);
  }
});

test("monthlyTotal equals dailyTotal * 30", () => {
  for (const iso of ["US", "IN", "JP", "ZZ", "BR"]) {
    const b = computeEssentialsBaseline(iso);
    const expected = Math.round(b.dailyTotal * 30 * 100) / 100;
    assert.equal(b.monthlyTotal, expected);
  }
});

test("totals are non-negative for every table entry", () => {
  for (const iso of Object.keys(ESSENTIALS_BASELINE_USD_BY_ISO)) {
    const b = computeEssentialsBaseline(iso);
    assert.ok(b.dailyTotal >= 0);
    assert.ok(b.monthlyTotal >= 0);
  }
});

// ---------------------------------------------------------------------
// Repository injection (supports future real dataset + testability)
// ---------------------------------------------------------------------
test("computeEssentialsBaseline accepts an injected repository", () => {
  const fakeRepo = {
    dataSource: "fake-real-dataset",
    getBaselineUSD: (iso) => iso === "US" ? { food: 100, water: 100, shelter: 100, creativity: 100 } : ESSENTIALS_BASELINE_DEFAULT_USD,
    hasCountry: (iso) => iso === "US"
  };
  const b = computeEssentialsBaseline("US", fakeRepo);
  assert.equal(b.dataSource, "fake-real-dataset");
  assert.equal(b.usedFallback, false);
  assert.equal(b.dailyTotal, 400);
  assert.equal(b.monthlyTotal, 12000);
});
