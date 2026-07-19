"use client";

import { KITCHEN_CATEGORIES } from "@/lib/recipe-tags";
import type { MainIngredientTag } from "@/types/database";
import { cn } from "@/lib/utils";

interface KitchenCategoryChipsProps {
  active: MainIngredientTag | null;
  onChange: (tag: MainIngredientTag | null) => void;
}

export function KitchenCategoryChips({
  active,
  onChange,
}: KitchenCategoryChipsProps) {
  return (
    <div className="flex gap-1.5 md:gap-2 flex-wrap mb-3.5 md:mb-5">
      {KITCHEN_CATEGORIES.map(({ tag, label }) => {
        const isActive = tag === active;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(tag)}
            className={cn(
              "font-semibold text-[11.5px] md:text-[12.5px] px-3 md:px-3.5 py-1.5 md:py-[7px] rounded-2xl border transition-colors",
              isActive
                ? "bg-[oklch(56%_0.15_35)] text-white border-[oklch(56%_0.15_35)]"
                : "bg-white text-[oklch(24%_0.02_50)] border-[oklch(88%_0.015_70)]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
