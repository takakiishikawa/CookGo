"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Clock,
  Check,
  X,
  Play,
  UtensilsCrossed,
  Users,
  CalendarPlus,
  Pencil,
  Copy,
  Trash2,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import {
  Button,
  Badge,
  Skeleton,
  Card,
  CardContent,
  Section,
  PageHeader,
  toast,
} from "@takaki/go-design-system";
import { Recipe, RecipeIngredient, RecipeStep } from "@/types/database";
import { cn } from "@/lib/utils";
import { useFoodImage } from "@/hooks/use-food-image";
import { LogMealDialog } from "@/components/log-meal-dialog";

interface RecipeDetailClientProps {
  recipe: Recipe;
  pantryItems: Array<{ name: string; in_stock: boolean }>;
}

function RecipeHeroImage({ recipe }: { recipe: Recipe }) {
  const query = recipe.title_en ?? recipe.title;
  const { imageUrl, loading } = useFoodImage(recipe.image_url ? null : query);
  const src = recipe.image_url ?? imageUrl;

  if (loading) return <Skeleton className="w-full h-56" />;
  if (!src) {
    return (
      <div className="w-full h-56 bg-surface-subtle flex items-center justify-center">
        <UtensilsCrossed
          className="w-12 h-12 text-muted-foreground"
          strokeWidth={1.5}
        />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={recipe.title}
      className="w-full h-56 object-cover"
      fetchPriority="high"
      loading="eager"
    />
  );
}

function StepImage({ query }: { query: string | null }) {
  const { imageUrl, loading } = useFoodImage(query);
  if (loading) {
    return <Skeleton className="w-full aspect-video rounded-md" />;
  }
  if (!imageUrl) return null;
  return (
    <img
      src={imageUrl}
      alt={query ?? ""}
      className="w-full aspect-video object-cover rounded-md"
      loading="lazy"
      decoding="async"
    />
  );
}

function IngredientThumb({ ing }: { ing: RecipeIngredient }) {
  const { imageUrl, loading } = useFoodImage(ing.name_en ?? ing.name);
  if (loading) {
    return <Skeleton className="w-12 h-12 rounded-md flex-shrink-0" />;
  }
  if (!imageUrl) {
    return (
      <div className="w-12 h-12 rounded-md bg-surface-subtle flex items-center justify-center flex-shrink-0">
        <UtensilsCrossed
          className="w-4 h-4 text-muted-foreground"
          strokeWidth={1.5}
        />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={ing.name}
      className="w-12 h-12 rounded-md object-cover flex-shrink-0"
      loading="lazy"
      decoding="async"
    />
  );
}

export function RecipeDetailClient({
  recipe,
  pantryItems,
}: RecipeDetailClientProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [logOpen, setLogOpen] = useState(false);

  const deleteRecipe = async () => {
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("削除しました");
      router.push("/recipes");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const duplicateRecipe = async () => {
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("複製しました");
      router.push(`/recipes/${data.recipe_id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "複製に失敗しました");
    }
  };

  const pantryNames = new Set(
    pantryItems.filter((p) => p.in_stock).map((p) => p.name.toLowerCase()),
  );
  const ingredients = (recipe.ingredients as RecipeIngredient[]) ?? [];
  const steps = [...((recipe.steps as RecipeStep[]) ?? [])].sort(
    (a, b) => a.order - b.order,
  );

  const inPantryCount = ingredients.filter((i) =>
    pantryNames.has(i.name.toLowerCase()),
  ).length;
  const needToBuyCount = ingredients.length - inPantryCount;
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.title + " 作り方")}`;

  const generateShoppingList = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/shopping/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id: recipe.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.items?.length) {
        toast.success("すべての食材が食材庫にあります");
      } else {
        toast.success(`${data.items.length}件を買い物リストに追加しました`);
        router.push("/shopping");
      }
    } catch {
      toast.error("買い物リスト生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const toggleStep = (order: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(order)) next.delete(order);
      else next.add(order);
      return next;
    });
  };

  return (
    <div className="flex flex-col">
      <AppHeader backHref="/recipes" />

      <div className="overflow-hidden">
        <RecipeHeroImage recipe={recipe} />
      </div>

      <div className="px-4 md:px-8 pt-5 pb-8 space-y-6 max-w-4xl">
        {recipe.source_tag && (
          <Badge variant="outline" className="self-start">
            {recipe.source_tag === "self"
              ? "自作"
              : recipe.source_tag === "ai_suggest"
                ? "AI提案"
                : "宅配"}
          </Badge>
        )}

        <PageHeader
          title={recipe.title}
          description={recipe.description ?? undefined}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <Link href={`/recipes/${recipe.id}/edit`}>
                  <Pencil className="w-3.5 h-3.5" />
                  編集
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={duplicateRecipe}
              >
                <Copy className="w-3.5 h-3.5" />
                複製
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={deleteRecipe}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                削除
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setLogOpen(true)}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                今日に追加
              </Button>
            </div>
          }
        />

        {/* Stats row */}
        {(recipe.prep_time_min ||
          (recipe.servings && recipe.servings > 1)) && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recipe.prep_time_min && (
              <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-2.5">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">調理時間</p>
                  <p className="text-sm font-semibold text-foreground">
                    {recipe.prep_time_min}分
                  </p>
                </div>
              </div>
            )}
            {recipe.servings && recipe.servings > 1 && (
              <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-2.5">
                <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">食分</p>
                  <p className="text-sm font-semibold text-foreground">
                    {recipe.servings}食分
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ingredients */}
        <Section
          title="食材リスト"
          description={`食材庫: ${inPantryCount}品 / 購入必要: ${needToBuyCount}品`}
        >
          {ingredients.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {ingredients.map((ing, i) => {
                  const inPantry = pantryNames.has(ing.name.toLowerCase());
                  const amountText = ing.unit
                    ? `${ing.amount}${ing.unit}`
                    : ing.amount;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md border",
                        inPantry
                          ? "bg-primary/5 border-primary/20"
                          : "bg-muted border-border",
                      )}
                    >
                      <IngredientThumb ing={ing} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {inPantry ? (
                            <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                          <p className="text-sm font-medium truncate">
                            {ing.name}
                          </p>
                        </div>
                        {(ing.name_en || ing.name_vi) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[ing.name_en, ing.name_vi]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm">{amountText}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {needToBuyCount > 0 && (
                <Button
                  size="sm"
                  onClick={generateShoppingList}
                  disabled={generating}
                  className="gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {generating
                    ? "生成中..."
                    : `買い物リストへ（${needToBuyCount}品）`}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">食材情報なし</p>
          )}
        </Section>

        {/* Steps */}
        {steps.length > 0 && (
          <Section
            title="作り方"
            description={`${completedSteps.size} / ${steps.length} ステップ完了`}
            actions={
              <a
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-destructive font-medium hover:underline"
              >
                <Play className="w-4 h-4" />
                動画で見る
              </a>
            }
          >
            <div className="space-y-4">
              {steps.map((step) => {
                const done = completedSteps.has(step.order);
                return (
                  <button
                    key={step.order}
                    onClick={() => toggleStep(step.order)}
                    className={cn(
                      "w-full text-left flex flex-col gap-3 p-4 rounded-lg border transition-colors",
                      done
                        ? "bg-primary/5 border-primary/20"
                        : "bg-card border-border hover:bg-muted",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold",
                          done
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {done ? <Check className="w-4 h-4" /> : step.order}
                      </div>
                      <p
                        className={cn(
                          "text-base leading-relaxed flex-1 text-left pt-1",
                          done && "line-through text-muted-foreground",
                        )}
                      >
                        {step.text}
                      </p>
                    </div>
                    {step.image_query && <StepImage query={step.image_query} />}
                  </button>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      <LogMealDialog
        recipe={logOpen ? recipe : null}
        onClose={() => setLogOpen(false)}
        onLogged={() => {
          setLogOpen(false);
          toast.success("今日の食事に追加しました");
        }}
      />
    </div>
  );
}
