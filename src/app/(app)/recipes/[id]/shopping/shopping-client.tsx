import { AppHeader } from "@/components/layout/app-header";
import type { Recipe } from "@/types/database";
import {
  groupIngredients,
  INGREDIENT_GROUP_LABELS_EN,
} from "@/lib/ingredient-categories";

interface ShoppingClientProps {
  recipe: Recipe;
}

export function ShoppingClient({ recipe }: ShoppingClientProps) {
  const groups = groupIngredients(
    recipe.ingredients ?? [],
    INGREDIENT_GROUP_LABELS_EN,
  );

  return (
    <div className="flex flex-col">
      <AppHeader backHref="/recipes" title="Shopping List" />

      <div className="px-4 md:px-8 py-8 flex justify-center">
        <div className="w-full max-w-sm bg-[oklch(98%_0.01_70)] rounded-[18px] p-6">
          <div className="flex justify-center mb-2.5">
            <div
              className="w-11 h-11 rounded-lg"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg,#d9c08a,#d9c08a 10px,#c7ab6f 10px,#c7ab6f 20px)",
              }}
            />
          </div>
          <p className="text-center font-serif font-bold text-base text-[oklch(24%_0.02_50)]">
            Shopping List
          </p>
          <p className="text-center text-xs text-[oklch(48%_0.02_50)] mt-0.5">
            {recipe.title}
          </p>
          <div className="flex justify-center items-center gap-2.5 mt-2.5">
            <span className="text-[11px] text-[oklch(48%_0.02_50)]">
              Serves
            </span>
            <span className="font-bold text-xs text-[oklch(24%_0.02_50)]">
              {recipe.servings}
            </span>
          </div>

          <div className="border-t border-dashed border-[oklch(80%_0.015_70)] my-3.5" />

          {groups.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              材料が登録されていません
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.group}>
                <p className="text-center font-mono font-semibold text-[11px] tracking-widest text-[oklch(56%_0.15_35)] mb-2">
                  — {g.label} —
                </p>
                {g.items.map(({ index, ingredient }) => (
                  <div
                    key={index}
                    className="flex justify-between py-1.5 text-[12.5px] text-[oklch(28%_0.02_50)]"
                  >
                    <span>
                      {ingredient.name_en || ingredient.name}{" "}
                      <span className="text-[10.5px] text-[oklch(52%_0.02_50)]">
                        ({ingredient.name}
                        {ingredient.name_vi ? ` / ${ingredient.name_vi}` : ""})
                      </span>
                    </span>
                    <span className="text-[oklch(45%_0.02_50)] shrink-0 pl-2">
                      {ingredient.amount}
                      {ingredient.unit ?? ""}
                    </span>
                  </div>
                ))}
                <div className="border-t border-dashed border-[oklch(85%_0.015_70)] my-2.5" />
              </div>
            ))
          )}

          <p className="text-center text-[11px] italic text-[oklch(50%_0.02_50)] mt-1">
            reference only — buy what fits your day
          </p>
        </div>
      </div>
    </div>
  );
}
