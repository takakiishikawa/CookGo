"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  LayoutGrid,
  Package,
  Plus,
  ShoppingBasket,
  UtensilsCrossed,
} from "lucide-react";
import { Button, EmptyState } from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { AddRecipeDialog } from "@/components/recipe/add-recipe-dialog";
import { RecipeModal } from "@/components/recipe/recipe-modal";
import { StaplesPopup } from "@/components/staples/staples-popup";
import { InventoryPopup } from "@/components/inventory/inventory-popup";
import {
  MAIN_INGREDIENT_TAGS,
  type InventoryItem,
  type MainIngredientTag,
  type Recipe,
  type Staple,
} from "@/types/database";
import { MAIN_INGREDIENT_TAG_ICON } from "@/lib/recipe-tags";
import { cn } from "@/lib/utils";

function FilterChip({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-shrink-0 rounded-full h-8 px-3 text-xs gap-1",
        !active && "text-muted-foreground hover:text-foreground",
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </Button>
  );
}

function GalleryTile({
  recipe,
  priority,
  onOpen,
}: {
  recipe: Recipe;
  priority: boolean;
  onOpen: (recipe: Recipe) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(recipe)}
      className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            sizes="(min-width: 640px) 33vw, 50vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <UtensilsCrossed
              className="w-10 h-10 text-muted-foreground/40"
              strokeWidth={1.5}
            />
          </div>
        )}
        {/* タイトル: モバイルは常時控えめ、PC はホバー時にだけ表示 */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/65 via-black/20 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <p className="text-white text-sm font-medium leading-tight line-clamp-2 drop-shadow-sm">
            {recipe.title}
          </p>
        </div>
      </div>
    </button>
  );
}

interface RecipesClientProps {
  recipes: Recipe[];
  staples: Staple[];
  inventory: InventoryItem[];
  userId: string;
}

export function RecipesClient({
  recipes,
  staples,
  inventory,
  userId,
}: RecipesClientProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [staplesOpen, setStaplesOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);
  // null = "すべて"。常にいずれか 1 つだけが選択される
  const [selectedTag, setSelectedTag] = useState<MainIngredientTag | null>(
    null,
  );

  const filteredRecipes = useMemo(() => {
    if (selectedTag === null) return recipes;
    return recipes.filter((r) => r.main_ingredient_tag === selectedTag);
  }, [recipes, selectedTag]);

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-6 pb-12 space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold leading-tight">レシピ</h1>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setInventoryOpen(true)}
              aria-label="在庫を開く"
              title="在庫"
            >
              <Package className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setStaplesOpen(true)}
              aria-label="定番を開く"
              title="定番"
            >
              <ShoppingBasket className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              onClick={() => setAddOpen(true)}
              aria-label="レシピを追加"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 主食材タグフィルタ (横スクロール、単一選択) */}
        {recipes.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1">
            <FilterChip
              active={selectedTag === null}
              onClick={() => setSelectedTag(null)}
              icon={LayoutGrid}
            >
              すべて
            </FilterChip>
            {MAIN_INGREDIENT_TAGS.map((tag) => (
              <FilterChip
                key={tag}
                active={selectedTag === tag}
                onClick={() => setSelectedTag(tag)}
                icon={MAIN_INGREDIENT_TAG_ICON[tag]}
              >
                {tag}
              </FilterChip>
            ))}
          </div>
        )}

        {recipes.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="w-6 h-6" />}
            title="レシピがまだありません"
            description="右上の + から追加しましょう"
          />
        ) : filteredRecipes.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="w-6 h-6" />}
            title="該当するレシピがありません"
            description="フィルタを変えてみましょう"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            {filteredRecipes.map((recipe, i) => (
              <GalleryTile
                key={recipe.id}
                recipe={recipe}
                priority={i < 6 /* 上 2 行は優先ロード */}
                onOpen={setOpenRecipe}
              />
            ))}
          </div>
        )}
      </div>

      <AddRecipeDialog open={addOpen} onOpenChange={setAddOpen} />
      <StaplesPopup
        open={staplesOpen}
        onOpenChange={setStaplesOpen}
        initialStaples={staples}
        userId={userId}
      />
      <InventoryPopup
        open={inventoryOpen}
        onOpenChange={setInventoryOpen}
        initialItems={inventory}
        userId={userId}
      />
      <RecipeModal
        recipe={openRecipe}
        onOpenChange={(o) => {
          if (!o) setOpenRecipe(null);
        }}
        onDeleted={() => setOpenRecipe(null)}
      />
    </div>
  );
}
