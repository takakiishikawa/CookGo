import type { LucideIcon } from "lucide-react";
import { Beef, Fish, Salad, Soup } from "lucide-react";
import type { MainIngredientTag } from "@/types/database";

/** 主食材タグに対応する lucide アイコン */
export const MAIN_INGREDIENT_TAG_ICON: Record<MainIngredientTag, LucideIcon> = {
  魚: Fish,
  肉: Beef,
  麺: Soup,
  "つまみ・副菜": Salad,
};

// 絵文字一般 + 国旗 (Regional Indicator) + 装飾系を網羅
const EMOJI_PATTERN =
  /[\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1FA70}-\u{1FAFF}‍️]/gu;

/** 既存データに残っている絵文字を表示時に取り除く */
export function stripEmoji(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(EMOJI_PATTERN, "").trim();
}

/** "🇯🇵日本" → "日本"。emoji が混じった旧データも国名のみ返す */
export function extractCountryName(
  countryTag: string | null | undefined,
): string {
  return stripEmoji(countryTag);
}

/**
 * 国名 → 国旗絵文字。表示専用(データには絵文字を保存しない)。
 * 不明な国名は null を返す。
 */
const COUNTRY_FLAG_MAP: Record<string, string> = {
  日本: "🇯🇵",
  中国: "🇨🇳",
  韓国: "🇰🇷",
  台湾: "🇹🇼",
  香港: "🇭🇰",
  タイ: "🇹🇭",
  ベトナム: "🇻🇳",
  インドネシア: "🇮🇩",
  マレーシア: "🇲🇾",
  フィリピン: "🇵🇭",
  シンガポール: "🇸🇬",
  インド: "🇮🇳",
  ネパール: "🇳🇵",
  イタリア: "🇮🇹",
  フランス: "🇫🇷",
  スペイン: "🇪🇸",
  ドイツ: "🇩🇪",
  イギリス: "🇬🇧",
  ロシア: "🇷🇺",
  トルコ: "🇹🇷",
  ギリシャ: "🇬🇷",
  ポルトガル: "🇵🇹",
  オランダ: "🇳🇱",
  ベルギー: "🇧🇪",
  メキシコ: "🇲🇽",
  ペルー: "🇵🇪",
  ブラジル: "🇧🇷",
  アルゼンチン: "🇦🇷",
  アメリカ: "🇺🇸",
  カナダ: "🇨🇦",
  エジプト: "🇪🇬",
  モロッコ: "🇲🇦",
  オーストラリア: "🇦🇺",
  ニュージーランド: "🇳🇿",
};

export function getCountryFlag(countryName: string | null): string | null {
  if (!countryName) return null;
  return COUNTRY_FLAG_MAP[countryName] ?? null;
}
