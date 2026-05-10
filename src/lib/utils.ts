export { cn } from "@takaki/go-design-system";

/**
 * country_tag (例: "🇯🇵日本") から国旗絵文字のみを抜き出す。
 * 国旗が見つからなければ null を返す。
 */
export function extractCountryFlag(countryTag: string | null): string | null {
  if (!countryTag) return null;
  // 国旗は Regional Indicator Symbol (U+1F1E6〜U+1F1FF) 2 つの組み合わせ
  const match = countryTag.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  return match ? match[0] : null;
}
