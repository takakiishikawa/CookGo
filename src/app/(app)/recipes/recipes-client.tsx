"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, UtensilsCrossed } from "lucide-react";
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import type { Recipe } from "@/types/database";
import { useFoodImage } from "@/hooks/use-food-image";

function RecipeImage({ recipe }: { recipe: Recipe }) {
  const query = recipe.title_en ?? recipe.title;
  const { imageUrl, loading } = useFoodImage(recipe.image_url ? null : query);
  const src = recipe.image_url ?? imageUrl;

  if (!recipe.image_url && loading) {
    return <Skeleton className="absolute inset-0 w-full h-full" />;
  }
  if (!src) {
    return (
      <div className="absolute inset-0 w-full h-full bg-surface-subtle flex items-center justify-center">
        <UtensilsCrossed
          className="w-8 h-8 text-muted-foreground/50"
          strokeWidth={1.5}
        />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={recipe.title}
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
      loading="lazy"
      decoding="async"
    />
  );
}

function GalleryTile({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        <RecipeImage recipe={recipe} />
        {/* タイトル: ホバー時にフェードイン(モバイルは常時表示) */}
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <p className="text-white text-xs sm:text-sm font-medium leading-tight line-clamp-2">
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

export function RecipesClient({ recipes: initialRecipes }: RecipesClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialRecipes;
    return initialRecipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.title_en?.toLowerCase().includes(q) ?? false) ||
        (r.description?.toLowerCase().includes(q) ?? false),
    );
  }, [initialRecipes, query]);

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-5 pb-8 space-y-5 max-w-6xl">
        <PageHeader
          title="レシピ"
          description={`${initialRecipes.length}件`}
          actions={
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => router.push("/recipes/new")}
            >
              <Plus className="w-3.5 h-3.5" />
              レシピを追加
            </Button>
          }
        />

        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="レシピを検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {initialRecipes.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="w-6 h-6" />}
            title="レシピがまだありません"
            description="「レシピを追加」から作りましょう"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="w-6 h-6" />}
            title="該当するレシピがありません"
            description="検索キーワードを変えてみてください"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
            {filtered.map((recipe) => (
              <GalleryTile key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
