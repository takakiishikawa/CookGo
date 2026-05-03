"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, RefreshCw } from "lucide-react";
import { Button, Card, CardContent, PageHeader } from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { IngredientThumb } from "@/components/recipe/ingredient-thumb";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/constants";
import { scaleAmountText } from "@/lib/amount-utils";
import {
  groupIngredients,
  type GroupedIngredients,
} from "@/lib/ingredient-categories";
import type {
  Recipe,
  RecipeIngredient,
  RecipeShoppingStateItem,
} from "@/types/database";

interface ShoppingClientProps {
  recipe: Recipe;
  initialItems: RecipeShoppingStateItem[];
  initialServings: number;
}

export function ShoppingClient({
  recipe,
  initialItems,
  initialServings,
}: ShoppingClientProps) {
  const supabase = createClient();
  const baseServings = Math.max(1, recipe.servings || 1);
  const ingredients = (recipe.ingredients as RecipeIngredient[]) ?? [];

  const [servings, setServings] = useState<number>(initialServings);
  const ratio = useMemo(() => servings / baseServings, [servings, baseServings]);

  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    ingredients.forEach((_, i) => {
      const found = initialItems.find((s) => s.index === i);
      initial[i] = found
        ? found.is_purchased || found.is_needed === false
        : false;
    });
    return initial;
  });

  const groups = useMemo<GroupedIngredients[]>(
    () => groupIngredients(ingredients),
    [ingredients],
  );

  const uncheckedGroups = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => !checkedMap[it.index]),
        }))
        .filter((g) => g.items.length > 0),
    [groups, checkedMap],
  );

  const checkedItems = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.filter((it) => !!checkedMap[it.index]),
      ),
    [groups, checkedMap],
  );

  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [saving, setSaving] = useState(false);

  const persistState = async (next: typeof checkedMap) => {
    setSaving(true);
    try {
      const items: RecipeShoppingStateItem[] = Object.entries(next).map(
        ([idx, checked]) => ({
          index: Number(idx),
          is_needed: true,
          is_purchased: checked,
        }),
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .schema(DB_SCHEMA)
        .from("recipe_shopping_state")
        .upsert(
          {
            user_id: user.id,
            recipe_id: recipe.id,
            state: { items },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,recipe_id" },
        );
    } catch (e) {
      console.error("shopping state save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistState(checkedMap), 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedMap]);

  const toggleChecked = (i: number) => {
    setCheckedMap((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  const renderItem = (index: number, ing: RecipeIngredient) => {
    const checked = !!checkedMap[index];
    const amountText = scaleAmountText(ing.amount, ing.unit, ratio);
    return (
      <div
        key={index}
        role="button"
        tabIndex={0}
        aria-pressed={checked}
        onClick={() => toggleChecked(index)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleChecked(index);
          }
        }}
        className={cn(
          "w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          checked
            ? "bg-primary/5 border-primary/40"
            : "bg-card border-border hover:bg-muted",
        )}
      >
        <IngredientThumb ingredient={ing} size="md" regenerable />
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                "text-sm font-medium truncate flex-1",
                checked && "line-through text-muted-foreground",
              )}
            >
              {ing.name}
            </p>
            <p
              className={cn(
                "text-xs tabular-nums whitespace-nowrap flex-shrink-0",
                checked
                  ? "line-through text-muted-foreground"
                  : "text-muted-foreground",
              )}
            >
              {amountText}
            </p>
          </div>
          {ing.name_en && (
            <p
              className={cn(
                "text-sm truncate text-muted-foreground/80",
                checked && "line-through",
              )}
            >
              {ing.name_en}
            </p>
          )}
          {ing.name_vi && (
            <p
              className={cn(
                "text-sm truncate text-muted-foreground/70",
                checked && "line-through",
              )}
            >
              {ing.name_vi}
            </p>
          )}
        </div>
        <div
          className={cn(
            "w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
            checked
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/30",
          )}
          aria-hidden
        >
          {checked && <Check className="w-3.5 h-3.5" />}
        </div>
      </div>
    );
  };

  const totalCount = ingredients.length;
  const checkedCount = useMemo(
    () => Object.values(checkedMap).filter(Boolean).length,
    [checkedMap],
  );
  const allDone = totalCount > 0 && checkedCount === totalCount;

  return (
    <div className="flex flex-col">
      <AppHeader
        breadcrumbs={[
          { label: "レシピ", href: "/recipes" },
          {
            label: recipe.title,
            href: `/recipes/${recipe.id}`,
          },
          { label: "買い物" },
        ]}
      />

      <div className="px-4 md:px-8 pt-5 pb-24 space-y-5 max-w-4xl">
        <PageHeader title="買い物" description={recipe.title} />

        {/* 進捗 + 人数 (購入済み/家にあるどちらでもチェック=「そろった」) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm tabular-nums">
            {allDone ? (
              <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                <Check className="w-4 h-4" />
                全部そろいました
              </span>
            ) : totalCount > 0 ? (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {checkedCount}
                </span>
                {" / "}
                {totalCount}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground mr-1">人数</span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              aria-label="人数を減らす"
            >
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <span className="text-base font-semibold tabular-nums w-8 text-center">
              {servings}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setServings((s) => Math.min(20, s + 1))}
              aria-label="人数を増やす"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
            {saving && (
              <RefreshCw className="ml-2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* 食材リスト (グループ別 + PC 2列) */}
        {totalCount === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              食材情報がありません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {uncheckedGroups.map((group) => (
              <div key={group.group} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm font-semibold">{group.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length}品
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.items.map(({ index, ingredient: ing }) =>
                    renderItem(index, ing),
                  )}
                </div>
              </div>
            ))}

            {checkedItems.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center gap-2 px-1 pt-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    購入済み
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {checkedItems.length}品
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {checkedItems.map(({ index, ingredient: ing }) =>
                    renderItem(index, ing),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
