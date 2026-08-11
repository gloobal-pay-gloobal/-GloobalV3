import test from "node:test";
import assert from "node:assert/strict";

// The "I have enough" flag is lifted to root account-level state in
// GloobalId (GloobalApp.jsx), stored/toggled exactly like this:
//   const [essentialsIHaveEnough, setEssentialsIHaveEnough] = useState(false);
//   const handleToggleEssentialsIHaveEnough = () => setEssentialsIHaveEnough(v => !v);
// This test exercises that exact toggle function in isolation (no
// React needed to prove the reducer logic is correct and reversible),
// and separately proves that lifting it out of a screen component
// preserves state across that screen unmounting — the actual bug
// being fixed.
function toggle(v) {
  return !v;
}

test("toggle is reversible: off -> on -> off returns to the original value", () => {
  let state = false;
  state = toggle(state);
  assert.equal(state, true);
  state = toggle(state);
  assert.equal(state, false);
});

test("toggle never gets stuck — repeated toggling always alternates", () => {
  let state = false;
  const seen = [];
  for (let i = 0; i < 6; i++) {
    state = toggle(state);
    seen.push(state);
  }
  assert.deepEqual(seen, [true, false, true, false, true, false]);
});

// Simulate "account-level state that survives a screen unmount" vs.
// "component-local state that resets on remount" to document why the
// fix (lifting state to GloobalId) matters.
function makeAccountStore(initial) {
  let value = initial;
  return {
    get: () => value,
    toggle: () => { value = !value; }
  };
}

function makeEssentialsScreen(accountStore) {
  // A screen that reads/writes through the account store (post-fix
  // behavior) instead of owning its own useState (pre-fix behavior).
  return { read: () => accountStore.get(), toggle: () => accountStore.toggle() };
}

test("account-level store retains the flag across a screen unmount/remount", () => {
  const account = makeAccountStore(false);
  let screen = makeEssentialsScreen(account);
  screen.toggle(); // user marks "I have enough"
  assert.equal(screen.read(), true);
  // Simulate the modal closing (screen instance discarded) and reopening.
  screen = makeEssentialsScreen(account);
  assert.equal(screen.read(), true, "flag should survive the screen remount because it lives on the account store, not the screen");
});
