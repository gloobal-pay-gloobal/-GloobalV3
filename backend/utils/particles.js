// src/utils/particles.js
function makeParticle(w, h, onlyFlag = null, varied = false, forceSign = null, countryPool = null) {
  const spawnX = Math.random() * w;
  const spawnY = h + 10 + Math.random() * 20;
  const bias = (spawnX / w - 0.5) * 2;
  let vx = bias * (0.2 + Math.random() * 0.3);
  let vy = -(0.35 + Math.random() * 0.4);
  if (varied) {
    const speedMul = 0.22 + Math.random() * 1.15;
    vx *= speedMul * 0.8;
    vy *= speedMul * 0.7;
  }
  const box = BOX_SIZES[Math.floor(Math.random() * BOX_SIZES.length)];
  const sign = forceSign || SIGN_TYPES[Math.floor(Math.random() * SIGN_TYPES.length)];
  let flag, code;
  if (countryPool && countryPool.length) {
    const pick = countryPool[Math.floor(Math.random() * countryPool.length)];
    flag = pick.flag;
    code = pick.code;
  } else {
    flag = onlyFlag || ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)].flag;
    code = null;
  }
  return {
    id: Math.random().toString(36).slice(2),
    sign,
    flag,
    code,
    box,
    pw: box,
    ph: box,
    spawnY,
    scale: GROWTH_START_SCALE,
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    opacity: 0,
    twinkleSpeed: 0.012 + Math.random() * 0.015,
    twinklePhase: Math.random() * Math.PI * 2
  };
}
function finRand(min, max) {
  return min + Math.random() * (max - min);
}
function finPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function makeFinSymbolParticle(i, opts) {
  const { brandChance, glowChance, sizeMin, sizeMax, driftMin, driftMax, symbols = FIN_SYMBOLS, opacityMin = 0.06, opacityMax = 0.2, colors } = opts;
  const edge = finPick(["top", "bottom", "left", "right"]);
  const along = finRand(4, 96);
  const isBrand = Math.random() < brandChance;
  const glow = Math.random() < glowChance;
  const signX = edge === "left" ? 1 : edge === "right" ? -1 : finRand(-1, 1);
  const signY = edge === "top" ? 1 : edge === "bottom" ? -1 : finRand(-1, 1);
  return {
    id: i,
    symbol: finPick(symbols),
    edge,
    along,
    size: finRand(sizeMin, sizeMax),
    color: colors ? finPick(colors) : isBrand ? finPick(FIN_BRAND_COLORS) : finPick(FIN_NEUTRAL_COLORS),
    duration: finRand(10, 24),
    delay: finRand(-22, 0),
    rotateStart: finRand(-24, 24),
    rotateEnd: finRand(-24, 24),
    dx: signX * finRand(driftMin, driftMax),
    dy: signY * finRand(driftMin, driftMax),
    peakOpacity: finRand(opacityMin, opacityMax),
    glow,
    glowDuration: finRand(3, 6),
    glowDelay: finRand(0, 3)
  };
}
function makeFinDotParticle(i) {
  const isBrand = Math.random() < 0.08;
  const glow = Math.random() < 0.15;
  return {
    id: i,
    x: finRand(2, 98),
    y: finRand(4, 96),
    size: finRand(2, 4.5),
    color: isBrand ? finPick(FIN_BRAND_COLORS) : finPick(FIN_NEUTRAL_COLORS),
    duration: finRand(6, 14),
    delay: finRand(-12, 0),
    peakOpacity: finRand(0.08, 0.2),
    glow,
    glowDuration: finRand(3, 6),
    glowDelay: finRand(0, 3)
  };
}

