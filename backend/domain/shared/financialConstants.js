// src/domain/shared/financialConstants.js
var ASSET_GROWTH_RATE_MONTHLY = 0.01;
// Short, configurable window after a transaction completes during
// which either party can raise a complaint. Configurable — not a
// hardcoded literal scattered through call sites.
var COMPLAINT_WINDOW_MINUTES_DEFAULT = 30;
// How long a receiver has to accept (or decline) a complaint
// conversation once one is opened, before it auto-expires.
var DISPUTE_RECEIVER_RESPONSE_HOURS_DEFAULT = 24;

