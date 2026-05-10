export interface RecipeIngredient {
  name: string;
  name_en: string | null;
  name_vi: string | null;
  amount: string;
  unit: string | null;
  category: string | null;
}

export type RecipeSourceTag = "self" | "ai_suggest" | "delivery";

export const RECIPE_SOURCE_LABELS: Record<RecipeSourceTag, string> = {
  self: "自作",
  ai_suggest: "AI提案",
  delivery: "宅配",
};

// ---------------------------------------------------------------------------
// レシピ分類タグ
// ---------------------------------------------------------------------------

/** 主食材タグ。トップのフィルタで使う */
export const MAIN_INGREDIENT_TAGS = ["魚", "肉", "麺", "つまみ・副菜"] as const;
export type MainIngredientTag = (typeof MAIN_INGREDIENT_TAGS)[number];

export const MAIN_INGREDIENT_TAG_EMOJI: Record<MainIngredientTag, string> = {
  魚: "🐟",
  肉: "🍖",
  麺: "🍜",
  "つまみ・副菜": "🥢",
};

/** 栄養プロファイルタグの代表例(AI は範囲外も可) */
export const NUTRITION_TAG_SUGGESTIONS = [
  "高タンパク",
  "炭水化物中心",
  "食物繊維豊富",
  "ビタミンB豊富",
  "マグネシウム豊富",
  "良質脂質",
] as const;

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  title_en: string | null;
  description: string | null;
  servings: number;
  prep_time_min: number | null;
  is_meal_prep_friendly: boolean;
  meal_prep_days: number | null;
  image_url: string | null;
  source_url: string | null;
  ingredients: RecipeIngredient[] | null;
  ai_generated: boolean;
  source_tag: RecipeSourceTag | null;
  /** 主食材タグ。例: "魚", "肉", "麺", "つまみ・副菜"。トップフィルタに使用 */
  main_ingredient_tag: MainIngredientTag | null;
  /** 発祥国タグ。絵文字+国名。例: "🇯🇵日本", "🇨🇳中国" */
  country_tag: string | null;
  /** 例: ["高タンパク", "良質脂質"] */
  nutrition_tags: string[];
  created_at: string;
}

export interface RecipeShoppingStateItem {
  index: number;
  is_needed: boolean;
  is_purchased: boolean;
}

export interface RecipeShoppingState {
  user_id: string;
  recipe_id: string;
  state: { items: RecipeShoppingStateItem[] };
  updated_at: string;
}

export const INGREDIENT_CATEGORIES = [
  "タンパク源",
  "野菜",
  "調味料",
  "炭水化物",
  "その他",
] as const;

// ---------------------------------------------------------------------------
// 食材辞典 (グローバル共有キャッシュ)
// ---------------------------------------------------------------------------

export interface IngredientPairing {
  food: string;
  reason: string;
}

export interface IngredientAlternative {
  name: string;
  reason: string;
}

export interface IngredientInfo {
  id: string;
  name: string;
  name_en: string | null;
  name_vi: string | null;
  category: string | null;
  origin: string | null;
  composition: string | null;
  taste_profile: string | null;
  pairings: IngredientPairing[];
  alternatives: IngredientAlternative[];
  nutrition_tags: string[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 在庫(常備食材)
// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  name_en: string | null;
  name_vi: string | null;
  category: string | null;
  sort_order: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Body management (PhysicalGo統合)
// ---------------------------------------------------------------------------

export interface Exercise {
  id: string;
  name: string; // 'bench_press' | 'half_deadlift' | 'pull_up'
  name_ja: string;
  created_at: string;
}

export const EXERCISE_NAMES = {
  BENCH_PRESS: "bench_press",
  HALF_DEADLIFT: "half_deadlift",
  PULL_UP: "pull_up",
} as const;

export type ExerciseName = (typeof EXERCISE_NAMES)[keyof typeof EXERCISE_NAMES];

export type RecordType = "weight_5rep" | "max_reps" | "volume";

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string;
  recorded_at: string;
  weight_kg: number | null;
  reps: number | null;
  record_type: RecordType;
  is_pr: boolean;
  note: string | null;
  created_at: string;
}

export interface PersonalRecordWithExercise extends PersonalRecord {
  exercises: Exercise;
}

export interface BodyRecord {
  id: string;
  user_id: string;
  recorded_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  note: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Staples（定番 = 定期的に購入する食材・日用品）
// ---------------------------------------------------------------------------

export interface Staple {
  id: string;
  user_id: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  created_at: string;
}
