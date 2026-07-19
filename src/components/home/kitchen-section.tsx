"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { EmptyState } from "@takaki/go-design-system";
import type { MainIngredientTag, Recipe } from "@/types/database";
import { youtubeSearchUrl } from "@/lib/recipe-links";
import { KitchenCategoryChips } from "@/components/home/kitchen-category-chips";
import { Tile } from "@/components/home/tile";
import { RecipeTileOverlay } from "@/components/recipe/recipe-tile-overlay";

interface KitchenSectionProps {
  recipes: Recipe[];
  category: MainIngredientTag | null;
  onCategoryChange: (tag: MainIngredientTag | null) => void;
  expandedTileId: string | null;
  onToggleExpand: (id: string) => void;
  onEdit: (recipe: Recipe) => void;
  onAddRecipe: () => void;
}

export function KitchenSection({
  recipes,
  category,
  onCategoryChange,
  expandedTileId,
  onToggleExpand,
  onEdit,
  onAddRecipe,
}: KitchenSectionProps) {
  const router = useRouter();

  const filtered = useMemo(
    () =>
      category === null
        ? recipes
        : recipes.filter((r) => r.main_ingredient_tag === category),
    [recipes, category],
  );

  return (
    <div>
      <KitchenCategoryChips active={category} onChange={onCategoryChange} />

      {recipes.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="w-6 h-6" />}
          title="レシピがまだありません"
          description="右上の + から追加しましょう"
          action={{ label: "レシピを追加", onClick: onAddRecipe }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="w-6 h-6" />}
          title="該当するレシピがありません"
          description="カテゴリを変えてみましょう"
        />
      ) : (
        <div className="columns-2 md:columns-4 gap-[9px] md:gap-3.5">
          {filtered.map((recipe, i) => (
            <Tile
              key={recipe.id}
              label={recipe.title}
              imageUrl={recipe.image_url}
              tintIndex={i * 3 + 1}
              heightIndex={i}
              onClick={() => onToggleExpand(recipe.id)}
            >
              <RecipeTileOverlay
                variant="kitchen"
                visible={expandedTileId === recipe.id}
                onShoppingClick={() =>
                  router.push(`/recipes/${recipe.id}/shopping`)
                }
                youtubeHref={youtubeSearchUrl(recipe.title)}
                sourceHref={recipe.source_url ?? undefined}
                onEdit={() => onEdit(recipe)}
              />
            </Tile>
          ))}
        </div>
      )}
    </div>
  );
}
