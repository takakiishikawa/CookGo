"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, UtensilsCrossed } from "lucide-react";
import { Button, EmptyState } from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { AddRecipeDialog } from "@/components/recipe/add-recipe-dialog";
import type { Recipe } from "@/types/database";

function GalleryTile({
  recipe,
  priority,
}: {
  recipe: Recipe;
  priority: boolean;
}) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl"
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
    </Link>
  );
}

interface RecipesClientProps {
  recipes: Recipe[];
}

export function RecipesClient({ recipes }: RecipesClientProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-6 pb-12 space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            レシピ
          </h1>
          <Button
            size="icon"
            onClick={() => setAddOpen(true)}
            aria-label="レシピを追加"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {recipes.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="w-6 h-6" />}
            title="レシピがまだありません"
            description="右上の + から追加しましょう"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            {recipes.map((recipe, i) => (
              <GalleryTile
                key={recipe.id}
                recipe={recipe}
                priority={i < 6 /* 上 2 行は優先ロード */}
              />
            ))}
          </div>
        )}
      </div>

      <AddRecipeDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
