import type {
  RecipeIngredient,
  RecipeSourceTag,
  MainIngredientTag,
  IngredientPairing,
  IngredientAlternative,
} from "./database";

export type { RecipeSourceTag };

/** AI 生成時に各食材に付随する解説。save 時に ingredient_info テーブルへ upsert */
export interface IngredientInfoDraft {
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
}

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
  source_tag?: RecipeSourceTag | null;
  source_url?: string | null;
  /** 既に画像 URL が確定している場合(URL取り込み時の og:image 等)に渡すと、save 時の Unsplash フォールバックをスキップ */
  image_url?: string | null;
  /** 主食材タグ。"魚" / "肉" / "麺" / "つまみ・副菜" */
  main_ingredient_tag: MainIngredientTag | null;
  /** 発祥国タグ。例: "🇯🇵日本", "🇨🇳中国" */
  country_tag: string | null;
  /** 例: ["高タンパク", "良質脂質"] */
  nutrition_tags: string[];
  /** 各食材の詳細解説。save 時に ingredient_info テーブルへ upsert */
  ingredient_info?: IngredientInfoDraft[];
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
