import type { RecipeIngredient } from "@/types/database";

export type IngredientCategory =
  | "protein"
  | "vegetable"
  | "carb"
  | "seasoning"
  | "other";

/** 食材表示・買い物リスト用の3グループに集約 */
export type IngredientGroup = "main" | "vegetable" | "seasoning";

export const INGREDIENT_GROUP_LABELS: Record<IngredientGroup, string> = {
  main: "メイン食材",
  vegetable: "野菜",
  seasoning: "調味料・その他",
};

export const INGREDIENT_GROUP_LABELS_EN: Record<IngredientGroup, string> = {
  main: "Main",
  vegetable: "Vegetables",
  seasoning: "Seasoning & Others",
};

const GROUP_ORDER: IngredientGroup[] = ["main", "vegetable", "seasoning"];

function categoryToGroup(category: string | null | undefined): IngredientGroup {
  const c = (category ?? "").toLowerCase();
  if (
    c === "protein" ||
    c === "carb" ||
    c === "タンパク源" ||
    c === "炭水化物"
  ) {
    return "main";
  }
  if (c === "vegetable" || c === "野菜") return "vegetable";
  // seasoning / other / unknown はすべて 調味料・その他 へ
  return "seasoning";
}

export interface GroupedIngredients {
  group: IngredientGroup;
  label: string;
  items: Array<{ index: number; ingredient: RecipeIngredient }>;
}

// -----------------------------------------------------------------------
// キーワードベースのカテゴリ推定 (AI 翻訳が "other" を返した場合のフォールバック)
// -----------------------------------------------------------------------

/** 完全一致 (substring) で判定する (en/ja 両方) */
const CATEGORY_KEYWORDS: { category: IngredientCategory; keywords: string[] }[] =
  [
    {
      category: "carb",
      keywords: [
        "パスタ",
        "麺",
        "うどん",
        "そば",
        "蕎麦",
        "ラーメン",
        "そうめん",
        "きしめん",
        "フェットチーネ",
        "リングイネ",
        "スパゲッティ",
        "ペンネ",
        "マカロニ",
        "米",
        "ごはん",
        "ご飯",
        "餅",
        "もち",
        "パン",
        "食パン",
        "ピザ",
        "ピザ生地",
        "オートミール",
        "シリアル",
        "コーンフレーク",
        "小麦粉",
        "薄力粉",
        "強力粉",
        "片栗粉",
        "とうもろこし粉",
        "クスクス",
        "キヌア",
        "pasta",
        "noodle",
        "spaghetti",
        "fettuccine",
        "linguine",
        "penne",
        "macaroni",
        "rice",
        "bread",
        "pizza",
        "oatmeal",
        "cereal",
        "flour",
        "couscous",
        "quinoa",
      ],
    },
    {
      category: "protein",
      keywords: [
        "鶏",
        "鶏肉",
        "鶏胸",
        "鶏もも",
        "鶏むね",
        "牛",
        "牛肉",
        "豚",
        "豚肉",
        "豚バラ",
        "ひき肉",
        "挽き肉",
        "ミンチ",
        "ハム",
        "ベーコン",
        "ソーセージ",
        "サラミ",
        "魚",
        "鮭",
        "サーモン",
        "サバ",
        "鯖",
        "マグロ",
        "鮪",
        "ツナ",
        "イワシ",
        "アジ",
        "鯛",
        "タラ",
        "鱈",
        "エビ",
        "海老",
        "イカ",
        "タコ",
        "ホタテ",
        "貝",
        "卵",
        "玉子",
        "卵黄",
        "卵白",
        "豆腐",
        "厚揚げ",
        "油揚げ",
        "納豆",
        "枝豆",
        "大豆",
        "黒豆",
        "ひよこ豆",
        "白いんげん",
        "ホワイトビーンズ",
        "レンズ豆",
        "ビーンズ",
        "豆",
        "chicken",
        "beef",
        "pork",
        "ham",
        "bacon",
        "sausage",
        "fish",
        "salmon",
        "tuna",
        "shrimp",
        "egg",
        "tofu",
        "bean",
        "lentil",
      ],
    },
    {
      category: "vegetable",
      keywords: [
        "野菜",
        "ほうれん草",
        "小松菜",
        "白菜",
        "キャベツ",
        "レタス",
        "ロメインレタス",
        "サラダ菜",
        "トマト",
        "ミニトマト",
        "プチトマト",
        "きゅうり",
        "胡瓜",
        "人参",
        "にんじん",
        "玉ねぎ",
        "玉葱",
        "たまねぎ",
        "長ねぎ",
        "白ねぎ",
        "青ねぎ",
        "セロリ",
        "アスパラ",
        "ピーマン",
        "パプリカ",
        "ナス",
        "なす",
        "茄子",
        "ズッキーニ",
        "ブロッコリー",
        "カリフラワー",
        "きのこ",
        "椎茸",
        "しいたけ",
        "舞茸",
        "まいたけ",
        "エリンギ",
        "しめじ",
        "マッシュルーム",
        "もやし",
        "豆苗",
        "ジャガイモ",
        "じゃがいも",
        "ポテト",
        "サツマイモ",
        "さつまいも",
        "里芋",
        "山芋",
        "大根",
        "かぼちゃ",
        "南瓜",
        "ごぼう",
        "蓮根",
        "れんこん",
        "生姜",
        "しょうが",
        "ニンニク",
        "にんにく",
        "ガーリック",
        "レモン",
        "ライム",
        "レモン汁",
        "spinach",
        "cabbage",
        "lettuce",
        "tomato",
        "cucumber",
        "carrot",
        "onion",
        "scallion",
        "celery",
        "asparagus",
        "broccoli",
        "cauliflower",
        "mushroom",
        "potato",
        "garlic",
        "ginger",
        "lemon",
        "lime",
      ],
    },
  ];

/**
 * 食材名 (日本語/英語どちらでも) からカテゴリを推測する。
 * AI 翻訳が "other" を返した場合の最終フォールバック。
 * マッチしない場合は null を返す。
 */
export function inferCategoryFromName(
  name: string | null | undefined,
): IngredientCategory | null {
  if (!name) return null;
  const haystack = name.toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const k of keywords) {
      if (haystack.includes(k.toLowerCase())) return category;
    }
  }
  return null;
}

/** ingredients を 3 グループに分けて、空グループは除外して返す。順序は固定。 */
export function groupIngredients(
  ingredients: RecipeIngredient[],
  labels: Record<IngredientGroup, string> = INGREDIENT_GROUP_LABELS,
): GroupedIngredients[] {
  const buckets: Record<IngredientGroup, GroupedIngredients["items"]> = {
    main: [],
    vegetable: [],
    seasoning: [],
  };
  ingredients.forEach((ing, index) => {
    buckets[categoryToGroup(ing.category)].push({ index, ingredient: ing });
  });
  return GROUP_ORDER.flatMap((g) =>
    buckets[g].length === 0
      ? []
      : [{ group: g, label: labels[g], items: buckets[g] }],
  );
}
