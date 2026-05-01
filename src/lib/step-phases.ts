import type { RecipeStep } from "@/types/database";

export interface StepPhase {
  name: string;
  steps: RecipeStep[];
}

/**
 * 6+ ステップなら 下準備/調理/仕上げ の3フェーズに分割。
 * 5以下は単一フェーズ(ヘッダ無し)で返す。
 */
export function groupStepsIntoPhases(steps: RecipeStep[]): StepPhase[] {
  if (steps.length <= 5) {
    return [{ name: "", steps }];
  }
  const n = steps.length;
  const cut1 = Math.max(1, Math.round(n / 3));
  const cut2 = Math.max(cut1 + 1, Math.round((n * 2) / 3));
  return [
    { name: "下準備", steps: steps.slice(0, cut1) },
    { name: "調理", steps: steps.slice(cut1, cut2) },
    { name: "仕上げ", steps: steps.slice(cut2) },
  ].filter((p) => p.steps.length > 0);
}
