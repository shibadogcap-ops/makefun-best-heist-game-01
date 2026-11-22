// A small seeded random number generator (mulberry32): the same seed gives the same game,
// which is what makes runs and screenshot scenes repeatable.

/** Returns a function that yields floats in [0, 1). */
export function createRng(seed) {
  let a = seed | 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [lo, hi). */
export function randRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/** A uniformly picked element of list. */
export function randPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
