/** Placeholder gradient shown for tiles without a saved image, keyed by index. */
export function dishTint(i: number): string {
  const hue = 18 + ((i * 37) % 70);
  return `repeating-linear-gradient(135deg, hsl(${hue} 45% 78%), hsl(${hue} 45% 78%) 14px, hsl(${hue} 40% 65%) 14px, hsl(${hue} 40% 65%) 28px)`;
}
