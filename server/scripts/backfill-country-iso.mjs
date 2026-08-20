// Repairs User.countryIso on accounts that were registered before the
// frontend sent one.
//
//   node scripts/backfill-country-iso.mjs              dry run
//   node scripts/backfill-country-iso.mjs --execute    writes
//
// The bug being repaired: POST /api/register-symbol has always stored
// countryIso, but the registration screen never sent it, so the route
// received undefined on every registration and wrote its 'IN' fallback.
// Every account created in that window is recorded as India-registered no
// matter where its owner actually is — which is what made a US payee
// resolve with an Indian flag and INR on the sender's Send Money screen.
//
// lib/accountCountry.js already derives the right answer at read time, so
// the API is correct with or without this script. What this does is write
// that answer down, so the stored field stops disagreeing with what every
// route reports and the derivation becomes a no-op.
//
// Only accounts holding the bare 'IN' default are touched, and only when
// their own E.164 mobile number says somewhere else — an account that
// really is Indian derives to 'IN' and is left alone, and an account that
// recorded any other country is never a candidate in the first place. So
// this is idempotent and safe to re-run.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(BACKEND, "server.js"));

require("dotenv").config({ path: join(BACKEND, ".env"), quiet: true });

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not set — this script needs server/.env.");
  process.exit(1);
}

const EXECUTE = process.argv.includes("--execute");

const mongoose = require(join(BACKEND, "node_modules/mongoose"));
const User = require(join(BACKEND, "models/User"));
const { DEFAULT_COUNTRY_ISO, deriveCountryIsoFromMobileNumber } = require(
  join(BACKEND, "lib/accountCountry")
);

async function main() {
  console.log(EXECUTE ? "Running LIVE (--execute) — this writes to Mongo." : "Dry run — pass --execute to write.");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // Candidates are accounts whose stored country is the bare default (or
  // missing entirely, on documents older than the field).
  const candidates = await User.find({
    $or: [{ countryIso: DEFAULT_COUNTRY_ISO }, { countryIso: { $exists: false } }, { countryIso: null }],
  })
    .select("_id symbolId mobileNumber countryIso")
    .lean();

  const repairs = [];
  for (const user of candidates) {
    const derived = deriveCountryIsoFromMobileNumber(user.mobileNumber);
    // No dial code to read, or it agrees with what is already stored.
    if (!derived || derived === DEFAULT_COUNTRY_ISO) continue;
    repairs.push({ _id: user._id, symbolId: user.symbolId, from: user.countryIso || "(unset)", to: derived });
  }

  console.log(`Accounts on the default country: ${candidates.length}`);
  console.log(`Accounts whose own number says otherwise: ${repairs.length}`);

  if (repairs.length) {
    const byIso = {};
    for (const r of repairs) byIso[r.to] = (byIso[r.to] || 0) + 1;
    console.table(Object.entries(byIso).map(([iso, count]) => ({ iso, count })));
    console.log("\nSample:");
    console.table(repairs.slice(0, 10).map((r) => ({ symbolId: r.symbolId, from: r.from, to: r.to })));
  }

  if (!EXECUTE) {
    console.log("\nDry run only — nothing written. Re-run with --execute to apply.");
    await mongoose.disconnect();
    return;
  }

  if (repairs.length) {
    const result = await User.bulkWrite(
      repairs.map((r) => ({
        updateOne: { filter: { _id: r._id }, update: { $set: { countryIso: r.to } } },
      })),
      { ordered: false }
    );
    console.log(`Updated ${result.modifiedCount} account(s).`);
  } else {
    console.log("Nothing to repair.");
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
