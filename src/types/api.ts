import type {
  RecipeIngredient,
  RecipeStep,
  RecipeSourceTag,
  MealType,
  FoodLogOverrides,
  FoodLogWithRecipe,
} from "./database";

export type { RecipeSourceTag };

// Draft recipe used during create/edit flows (before save).
export interface DraftRecipe {
  title: string;
  title_en: string | null;
  description: string | null;
  prep_time_min: number | null;
  is_meal_prep_friendly: boolean;
  meal_prep_days: number | null;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  source_tag?: RecipeSourceTag | null;
}

// POST /api/recipes/from-name
export interface RecipeFromNameRequest {
  title: string;
}
export interface RecipeFromNameResponse {
  recipe: DraftRecipe;
}

// POST /api/recipes/suggest-candidates
export interface RecipeSuggestCandidatesRequest {
  conditions: string;
}
export interface RecipeSuggestCandidatesResponse {
  candidates: DraftRecipe[];
}

// POST /api/recipes/save (create new from draft)
// PUT  /api/recipes/save?id=...  (update existing from draft)
export interface RecipeSaveRequest {
  recipe: DraftRecipe;
  source_tag: RecipeSourceTag;
}
export interface RecipeSaveResponse {
  recipe_id: string;
}

// POST /api/recipes/save-many (batch create from candidates)
export interface RecipeSaveManyRequest {
  recipes: DraftRecipe[];
  source_tag: RecipeSourceTag;
}
export interface RecipeSaveManyResponse {
  recipe_ids: string[];
}

// POST /api/food-logs
export interface FoodLogCreateRequest {
  recipe_id: string;
  logged_date: string;
  meal_type: MealType;
  servings?: number;
  overrides?: FoodLogOverrides | null;
}
export interface FoodLogCreateResponse {
  food_log: FoodLogWithRecipe;
}

// POST /api/food-logs/repeat
export interface FoodLogRepeatRequest {
  food_log_id: string;
  logged_date: string;
}
export interface FoodLogRepeatResponse {
  food_log: FoodLogWithRecipe;
}

// GET /api/food-logs?date=...
// GET /api/food-logs?start=...&end=...
export interface FoodLogsListResponse {
  logs: FoodLogWithRecipe[];
}

// GET /api/food-logs/recent?meal_type=...&limit=...
export interface FoodLogsRecentResponse {
  logs: FoodLogWithRecipe[];
}

// Plan mapping
export interface PlanMapRequest {
  recipe_id: string;
  planned_date: string;
  meal_type: MealType;
  servings: number;
  repeat_rule: "none" | "daily" | "weekdays" | "custom";
  repeat_days: number[];
  repeat_until: string | null;
}

export interface PlanMapResponse {
  plans_created: number;
}

// Image
export interface ImageResponse {
  imageUrl: string | null;
}

// Translation
export interface TranslationEntry {
  en: string;
  vi: string;
}

export interface TranslateRequest {
  names: string[];
}

export interface TranslateResponse {
  translations: Record<string, TranslationEntry>;
}

// Food image / pantry suggest (legacy compat)
export interface FoodImageResponse {
  imageUrl: string | null;
}

export interface FoodSuggestResponse {
  imageUrl: string | null;
  category: string;
}

// Shopping list
export interface ShoppingGenerateRequest {
  recipe_id: string;
}
