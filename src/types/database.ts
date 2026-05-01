export interface RecipeIngredient {
  name: string;
  name_en: string | null;
  name_vi: string | null;
  amount: string;
  unit: string | null;
  in_pantry: boolean;
  category: string | null;
}

export interface RecipeStep {
  order: number;
  text: string;
  image_query: string | null;
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
  is_tried: boolean;
  meal_prep_days: number | null;
  image_url: string | null;
  ingredients: RecipeIngredient[] | null;
  steps: RecipeStep[] | null;
  ai_generated: boolean;
  source_tag: RecipeSourceTag | null;
  created_at: string;
}

export interface MealPlan {
  id: string;
  user_id: string;
  recipe_id: string;
  planned_date: string;
  meal_type: "breakfast" | "lunch" | "dinner";
  servings: number;
  repeat_rule: "none" | "daily" | "weekdays" | "custom";
  repeat_days: number[] | null;
  repeat_until: string | null;
  created_at: string;
}

export interface MealPlanWithRecipe extends MealPlan {
  recipe: Pick<Recipe, "id" | "title" | "title_en" | "image_url">;
}

export interface PantryItem {
  id: string;
  user_id: string;
  name: string;
  name_en: string | null;
  name_vi: string | null;
  image_url: string | null;
  category: string | null;
  in_stock: boolean;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  user_id: string;
  name: string;
  name_en: string | null;
  name_vi: string | null;
  image_url: string | null;
  amount: string | null;
  checked: boolean;
  added_to_pantry: boolean;
  created_at: string;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export interface FoodLogIngredientOverride {
  index: number;
  amount?: string;
  unit?: string | null;
}

export interface FoodLogOverrides {
  ingredients?: FoodLogIngredientOverride[];
}

export interface FoodLog {
  id: string;
  user_id: string;
  recipe_id: string;
  logged_date: string;
  meal_type: MealType;
  servings: number;
  overrides: FoodLogOverrides | null;
  created_at: string;
}

export interface FoodLogWithRecipe extends FoodLog {
  recipe: Pick<Recipe, "id" | "title" | "title_en" | "image_url" | "servings">;
}

export const PANTRY_CATEGORIES = [
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
