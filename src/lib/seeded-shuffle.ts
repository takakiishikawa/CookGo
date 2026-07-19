/**
 * Deterministic per-visit shuffle: looks random but stays stable while
 * browsing (same `visitSeed`), re-randomizes on the next page load. Ported
 * from the HomeCook design mockup's `shuffled()` algorithm.
 */
export function seededShuffle<T>(
  arr: T[],
  seedKey: string,
  visitSeed: number,
): T[] {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) {
    seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  seed = (seed ^ Math.floor(visitSeed * 1e9)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
