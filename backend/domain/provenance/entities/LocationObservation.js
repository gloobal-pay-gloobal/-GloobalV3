// src/domain/provenance/entities/LocationObservation.js
// Replaces the old GeoCapture value object. A location is never just
// coordinates — it's an OBSERVATION with an explicit outcome, because
// "we don't know" and "we asked and were refused" and "we asked and
// got nothing back in time" are different real states, not the same
// null. Backend storage always keeps latitude, longitude, accuracy,
// observedAt AND status together — status is never inferred after the
// fact from missing fields.
var LOCATION_STATUS = {
  // A real coordinate fix was obtained just now.
  AVAILABLE: "available",
  // The device/browser was asked and the user (or OS) refused.
  DENIED: "denied",
  // No location capability exists on this device/context at all.
  UNAVAILABLE: "unavailable",
  // Asked, but no answer arrived inside the allotted window.
  TIMEOUT: "timeout",
  // A real fix exists but it's old enough that presenting it as
  // "current" would be misleading — coordinates are preserved, never
  // discarded, just relabeled honestly.
  STALE: "stale",
  // No observation channel exists for this party at all (e.g. no
  // connected receiver device in this build). Never a made-up city —
  // the explicit absence of data itself.
  UNKNOWN: "unknown"
};
var LOCATION_STALE_AFTER_MS_DEFAULT = 5 * 60 * 1e3;
var LocationObservation = class {
  constructor({ status, latitude = null, longitude = null, accuracy = null, observedAt = null } = {}) {
    this.status = Object.values(LOCATION_STATUS).includes(status) ? status : LOCATION_STATUS.UNKNOWN;
    this.latitude = typeof latitude === "number" && Number.isFinite(latitude) ? latitude : null;
    this.longitude = typeof longitude === "number" && Number.isFinite(longitude) ? longitude : null;
    this.accuracy = typeof accuracy === "number" && Number.isFinite(accuracy) ? accuracy : null;
    this.observedAt = observedAt || null;
    Object.freeze(this);
  }
  hasCoordinates() {
    return this.latitude !== null && this.longitude !== null && this.latitude >= -90 && this.latitude <= 90 && this.longitude >= -180 && this.longitude <= 180;
  }
};
function unknownObservation() {
  return new LocationObservation({ status: LOCATION_STATUS.UNKNOWN });
}
// Coerces arbitrary input to a LocationObservation without ever
// inventing coordinates — anything that isn't already a valid
// observation becomes UNKNOWN, the same "explicit absence" state a
// missing receiver channel produces.
function asObservation(input) {
  if (input instanceof LocationObservation) return input;
  return unknownObservation();
}
// Re-evaluates freshness at the moment a completion is recorded (or
// later re-read) — an AVAILABLE fix captured too long before this
// call is downgraded to STALE. Coordinates are carried forward
// unchanged; nothing is fabricated or dropped, only relabeled.
function withFreshness(observation, now = /* @__PURE__ */ new Date(), maxAgeMs = LOCATION_STALE_AFTER_MS_DEFAULT) {
  if (!observation || observation.status !== LOCATION_STATUS.AVAILABLE || !observation.observedAt) return observation;
  const age = now.getTime() - new Date(observation.observedAt).getTime();
  if (age > maxAgeMs) {
    return new LocationObservation({ status: LOCATION_STATUS.STALE, latitude: observation.latitude, longitude: observation.longitude, accuracy: observation.accuracy, observedAt: observation.observedAt });
  }
  return observation;
}

