"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  UtensilsCrossed,
  CheckCircle2,
  CalendarPlus,
  Copy,
  Trash2,
} from "lucide-react";
import {
  Button,
  Badge,
  EmptyState,
  Card,
  CardContent,
  Skeleton,
  PageHeader,
  toast,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { Recipe, MealType, RECIPE_SOURCE_LABELS } from "@/types/database";
import { useFoodImage } from "@/hooks/use-food-image";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db";
import { LogMealDialog } from "@/components/log-meal-dialog";

function RecipeImage({ recipe }: { recipe: Recipe }) {
  const query = recipe.title_en ?? recipe.title;
  const { imageUrl, loading } = useFoodImage(recipe.image_url ? null : query);
  const src = recipe.image_url ?? imageUrl;

  if (!recipe.image_url && loading) return <Skeleton className="w-full h-40" />;
  if (!src) {
    return (
      <div className="w-full h-40 bg-surface-subtle flex items-center justify-center">
        <UtensilsCrossed
          className="w-8 h-8 text-muted-foreground"
          strokeWidth={1.5}
        />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={recipe.title}
      className="w-full h-40 object-cover bg-muted"
      loading="lazy"
      decoding="async"
    />
  );
}

function RecipeCard({
  recipe,
  onToggleTried,
  onLog,
  onDelete,
  onDuplicate,
}: {
  recipe: Recipe;
  onToggleTried: (id: string, tried: boolean) => void;
  onLog: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
}) {
  return (
    <div className="relative">
      <Link href={`/recipes/${recipe.id}`}>
        <Card className="overflow-hidden hover:border border-border transition-shadow h-full flex flex-col">
          <div className="overflow-hidden">
            <RecipeImage recipe={recipe} />
          </div>
          <CardContent className="p-3 space-y-2 flex-1 flex flex-col">
            <p className="font-semibold text-foreground text-sm line-clamp-2 leading-snug flex-1">
              {recipe.title}
            </p>
            <div className="flex flex-wrap gap-1">
              {recipe.is_tried && (
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-transparent"
                >
                  作った
                </Badge>
              )}
              {recipe.source_tag && (
                <Badge variant="outline" className="text-xs">
                  {RECIPE_SOURCE_LABELS[recipe.source_tag]}
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="default"
                onClick={(e) => {
                  e.preventDefault();
                  onLog(recipe);
                }}
                title="今日に追加"
                className="flex-1"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  onDuplicate(recipe);
                }}
                title="複製"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(recipe);
                }}
                title="削除"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          onToggleTried(recipe.id, !recipe.is_tried);
        }}
        className={`absolute top-2 right-2 rounded-full p-1 transition-colors ${
          recipe.is_tried
            ? "bg-primary text-white"
            : "bg-background/80 text-muted-foreground hover:text-primary"
        }`}
        title={recipe.is_tried ? "未作成に戻す" : "作ったことある"}
      >
        <CheckCircle2 className="w-5 h-5" />
      </button>
    </div>
  );
}

interface RecipesClientProps {
  recipes: Recipe[];
}

export function RecipesClient({ recipes: initialRecipes }: RecipesClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [logTarget, setLogTarget] = useState<Recipe | null>(null);
  const [defaultMealType] = useState<MealType>("dinner");

  const deleteRecipe = async (recipe: Recipe) => {
    setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`${recipe.title} を削除しました`);
    } catch (err) {
      setRecipes((prev) => [recipe, ...prev]);
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const duplicateRecipe = async (recipe: Recipe) => {
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`${recipe.title}（コピー）を作成しました`);
      router.push(`/recipes/${data.recipe_id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "複製に失敗しました");
    }
  };

  const toggleTried = async (id: string, isTried: boolean) => {
    const { error } = await db.recipes.update(supabase, id, {
      is_tried: isTried,
    });
    if (error) {
      toast.error("更新に失敗しました");
      return;
    }
    setRecipes(
      recipes.map((r) => (r.id === id ? { ...r, is_tried: isTried } : r)),
    );
  };

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-5 pb-8 space-y-5 max-w-5xl">
        <PageHeader
          title="レシピ"
          description={`${recipes.length}件`}
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

        {recipes.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="w-6 h-6" />}
            title="レシピがまだありません"
            description="「レシピを追加」から作りましょう"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onToggleTried={toggleTried}
                onLog={setLogTarget}
                onDelete={deleteRecipe}
                onDuplicate={duplicateRecipe}
              />
            ))}
          </div>
        )}
      </div>

      <LogMealDialog
        recipe={logTarget}
        defaultMealType={defaultMealType}
        onClose={() => setLogTarget(null)}
        onLogged={() => {
          toast.success("追加しました");
          setLogTarget(null);
        }}
      />
    </div>
  );
}
