// src/data/coverage.js
var COVERAGE_COUNTRIES_RAW = [
  { code: "IN", lat: 20.5937, lng: 78.9629, integrated: "Jan 2023", baseVolume: 12.45, baseTps: 1450, baseUsers: 245e4, zoom: 2.2 },
  { code: "US", lat: 39.8283, lng: -98.5795, integrated: "Nov 2022", baseVolume: 45.32, baseTps: 5200, baseUsers: 318e4, zoom: 1.8 },
  { code: "GB", lat: 55.3781, lng: -3.436, integrated: "Feb 2023", baseVolume: 8.91, baseTps: 980, baseUsers: 54e4, zoom: 4.5 },
  { code: "PK", lat: 30.3753, lng: 69.3451, integrated: "Mar 2024", baseVolume: 8.32, baseTps: 2145, baseUsers: 612e3, zoom: 3 },
  { code: "CA", lat: 56.1304, lng: -106.3468, integrated: "May 2023", baseVolume: 5.67, baseTps: 640, baseUsers: 322e3, zoom: 1.5 },
  { code: "DE", lat: 51.1657, lng: 10.4515, integrated: "Jul 2023", baseVolume: 7.14, baseTps: 810, baseUsers: 41e4, zoom: 4 },
  { code: "BR", lat: -14.235, lng: -51.9253, integrated: "Sep 2023", baseVolume: 6.28, baseTps: 730, baseUsers: 483e3, zoom: 1.7 },
  { code: "AE", lat: 23.4241, lng: 53.8478, integrated: "Apr 2024", baseVolume: 4.02, baseTps: 505, baseUsers: 191e3, zoom: 5.5 },
  { code: "CN", lat: 35.8617, lng: 104.1954, integrated: "Jun 2023", baseVolume: 22.1, baseTps: 3100, baseUsers: 154e4, zoom: 1.7 },
  { code: "JP", lat: 36.2048, lng: 138.2529, integrated: "Aug 2023", baseVolume: 9.87, baseTps: 1120, baseUsers: 602e3, zoom: 3.8 },
  { code: "FR", lat: 46.6034, lng: 1.8883, integrated: "Oct 2023", baseVolume: 6.94, baseTps: 760, baseUsers: 388e3, zoom: 4 },
  { code: "IT", lat: 41.8719, lng: 12.5674, integrated: "Dec 2023", baseVolume: 5.42, baseTps: 605, baseUsers: 301e3, zoom: 4.2 },
  { code: "RU", lat: 61.524, lng: 105.3188, integrated: "Jan 2024", baseVolume: 4.88, baseTps: 540, baseUsers: 275e3, zoom: 1.2 },
  { code: "KR", lat: 35.9078, lng: 127.7669, integrated: "Feb 2024", baseVolume: 7.21, baseTps: 820, baseUsers: 356e3, zoom: 5 },
  { code: "AU", lat: -25.2744, lng: 133.7751, integrated: "Mar 2024", baseVolume: 4.55, baseTps: 490, baseUsers: 228e3, zoom: 1.8 },
  { code: "ES", lat: 40.4637, lng: -3.7492, integrated: "May 2024", baseVolume: 4.19, baseTps: 455, baseUsers: 214e3, zoom: 4.3 },
  { code: "MX", lat: 23.6345, lng: -102.5528, integrated: "Jun 2024", baseVolume: 5.03, baseTps: 560, baseUsers: 267e3, zoom: 2.8 },
  { code: "ID", lat: -0.7893, lng: 113.9213, integrated: "Jul 2024", baseVolume: 6.61, baseTps: 705, baseUsers: 349e3, zoom: 1.9 },
  { code: "NL", lat: 52.1326, lng: 5.2913, integrated: "Aug 2024", baseVolume: 3.42, baseTps: 380, baseUsers: 176e3, zoom: 5.5 },
  { code: "SA", lat: 23.8859, lng: 45.0792, integrated: "Sep 2024", baseVolume: 3.98, baseTps: 420, baseUsers: 199e3, zoom: 2.8 },
  { code: "CH", lat: 46.8182, lng: 8.2275, integrated: "Oct 2024", baseVolume: 3.1, baseTps: 340, baseUsers: 152e3, zoom: 6 },
  { code: "TR", lat: 38.9637, lng: 35.2433, integrated: "Nov 2024", baseVolume: 3.77, baseTps: 400, baseUsers: 187e3, zoom: 3.5 }
];
var COVERAGE_COUNTRIES = COVERAGE_COUNTRIES_RAW.map((c) => ({
  ...c,
  name: COUNTRY_BY_ISO[c.code]?.name || c.code
}));
var ACTIVE_ISO_SET = new Set(COVERAGE_COUNTRIES_RAW.map((c) => c.code));
var COVERAGE_BY_ISO = Object.fromEntries(COVERAGE_COUNTRIES.map((c) => [c.code, c]));
var COVERAGE_ALL_COUNTRIES = ALL_COUNTRIES.map((c) => {
  const code = c.iso;
  const live = ACTIVE_ISO_SET.has(code);
  return { ...c, code, active: live, coverage: live ? COVERAGE_BY_ISO[code] : null };
});

