import type {
  RecipeIngredient,
  RecipeStep,
  RecipeSourceTag,
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
  source_url?: string | null;
  /** 既に画像 URL が確定している場合(URL取り込み時の og:image 等)に渡すと、save 時の Unsplash フォールバックをスキップ */
  image_url?: string | null;
  /** 特徴タグ (例: ["BONIQ公式", "湯せん低温調理"])。import 時 Claude が生成 */
  tags?: string[] | null;
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
