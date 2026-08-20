// Backend/lib/accountCountry.js
//
// One answer to "which country is this account registered in", shared by
// every route and service that needs it.
//
// It lives in its own module rather than inside server.js because the
// answer decides three separate things that MUST agree: what
// GET /api/users/resolve tells a sender about their payee (which is what
// draws the receiver's flag and picks the amount box's currency), what
// currency POST /api/transactions/send actually converts and credits in,
// and which CountryCurrencyPool lib/settlementEngine.js settles against.
// When those read the field three different ways they disagree about the
// same person, and the screen shows one currency while the money moves in
// another.
//
// --- Why the stored field alone is not the answer -----------------------
//
// User.countryIso has existed since the multi-currency work, and
// POST /api/register-symbol has always written it. But the registration
// screen never SENT a country, so the route received undefined every time
// and stored its 'IN' fallback. Every account created before that was
// fixed is recorded as India-registered no matter where its owner is —
// which is why an American payee resolved with an Indian flag and INR on
// an Indian sender's Send Money screen. The right person, the wrong
// country, and (through the FX conversion) the wrong amount.
//
// The frontend sends the country now, so accounts created from here on are
// correct at the source. The ones already written are not, and nothing
// records whether a stored 'IN' was a real choice or the default standing
// in for one. So the bare default is treated as "unrecorded" and yields to
// the account's own E.164 mobile number, which is the only other piece of
// registration data that carries a country at all. Any other stored value
// was a real choice and is returned untouched — a derived guess never
// overrides a recorded fact.
//
// scripts/backfill-country-iso.mjs writes these same answers back to the
// documents; once it has run, stored and derived agree and deriveFor()
// stops doing anything.

const FRONTEND_COUNTRY_LIST = require('../data/frontendCountryList.json');

// The schema default in models/User.js. Load-bearing: it is the one stored
// value that cannot be told apart from "never recorded", and therefore the
// only one a derived country is allowed to correct.
const DEFAULT_COUNTRY_ISO = 'IN';

// (iso, dialCode) for the 194 countries the registration picker offers,
// longest dial code first so a prefix match takes +1876 (Jamaica) over +1
// and +44 over +4. A shorter code can prefix a longer one, so matching in
// file order would quietly pick the wrong country.
//
// Genuinely ambiguous codes exist and no number of digits separates them:
// +1 covers the US, Canada and most of the Caribbean; +7 covers Russia and
// Kazakhstan. Those resolve to whichever of the tied countries the picker
// lists first. That imprecision is acceptable precisely because this is
// only ever consulted for an account with NO country of its own recorded —
// a US/CA mix-up is strictly better than calling every such account Indian,
// and any account that recorded a country never reaches this at all.
const COUNTRY_DIAL_ROWS = FRONTEND_COUNTRY_LIST
  .map((row) => ({ iso: String(row.iso || '').toUpperCase(), dial: String(row.dial || '') }))
  .filter((row) => /^[A-Z]{2}$/.test(row.iso) && /^\+\d+$/.test(row.dial))
  .sort((a, b) => b.dial.length - a.dial.length);

// The country an E.164 number belongs to, or null when the number carries
// no country signal at all. A number stored without a leading '+' has no
// dial code to read — matching on bare digits would make "911..." Indian
// and "1800..." American on nothing but coincidence — so it answers null
// rather than guessing.
function deriveCountryIsoFromMobileNumber(mobileNumber) {
  const compact = String(mobileNumber || '').replace(/[^\d+]/g, '');
  if (!compact.startsWith('+')) return null;
  const match = COUNTRY_DIAL_ROWS.find((row) => compact.startsWith(row.dial));
  return match ? match.iso : null;
}

// The registered country of a User document (or anything with countryIso
// and mobileNumber on it). Always returns a two-letter ISO code.
function accountCountryIso(user) {
  const stored = String((user && user.countryIso) || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(stored) && stored !== DEFAULT_COUNTRY_ISO) return stored;
  return deriveCountryIsoFromMobileNumber(user && user.mobileNumber) || DEFAULT_COUNTRY_ISO;
}

module.exports = {
  DEFAULT_COUNTRY_ISO,
  deriveCountryIsoFromMobileNumber,
  accountCountryIso,
};
