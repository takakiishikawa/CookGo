import type { RecipeIngredient } from "@/types/database";

/** 食材表示・買い物リスト用の3グループに集約 */
export type IngredientGroup = "main" | "vegetable" | "seasoning";

export const INGREDIENT_GROUP_LABELS: Record<IngredientGroup, string> = {
  main: "メイン食材",
  vegetable: "野菜",
  seasoning: "調味料・その他",
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

/** ingredients を 3 グループに分けて、空グループは除外して返す。順序は固定。 */
export function groupIngredients(
  ingredients: RecipeIngredient[],
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
      : [{ group: g, label: INGREDIENT_GROUP_LABELS[g], items: buckets[g] }],
  );
}
