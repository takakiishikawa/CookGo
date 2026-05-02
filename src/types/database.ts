export interface RecipeIngredient {
  name: string;
  name_en: string | null;
  name_vi: string | null;
  amount: string;
  unit: string | null;
  category: string | null;
}

export interface RecipeStep {
  order: number;
  text: string;
  image_query: string | null;
  /** 元 URL のページから抽出した直接画像 URL。設定があれば image_query より優先 */
  image_url?: string | null;
}

export type RecipeSourceTag = "self" | "ai_suggest" | "delivery";

export const RECIPE_SOURCE_LABELS: Record<RecipeSourceTag, string> = {
  self: "自作",
  ai_suggest: "AI提案",
  delivery: "宅配",
};

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
  steps: RecipeStep[] | null;
  ai_generated: boolean;
  source_tag: RecipeSourceTag | null;
  /** 短い特徴タグ (例: ["BONIQ公式", "湯せん低温調理"])。recipes テーブルの tags 列 */
  tags: string[] | null;
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
