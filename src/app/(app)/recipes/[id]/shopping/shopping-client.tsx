"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  PageHeader,
  toast,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
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
  const router = useRouter();
  const supabase = createClient();
  const baseServings = Math.max(1, recipe.servings || 1);
  const ingredients = (recipe.ingredients as RecipeIngredient[]) ?? [];

  const [servings, setServings] = useState<number>(initialServings);
  const ratio = useMemo(() => servings / baseServings, [servings, baseServings]);

  // index ごとの「チェック済(=持ってる or 買った)」状態
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    ingredients.forEach((_, i) => {
      const found = initialItems.find((s) => s.index === i);
      // 旧スキーマ互換: is_purchased もしくは !is_needed をチェック扱いに
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

  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [saving, setSaving] = useState(false);

  const persistState = async (next: typeof checkedMap) => {
    setSaving(true);
    try {
      const items: RecipeShoppingStateItem[] = Object.entries(next).map(
        ([idx, checked]) => ({
          index: Number(idx),
          // 互換: チェック済 = is_purchased: true (is_needed は常に true で残す)
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

  const clearList = async () => {
    if (
      !confirm(
        "買い物リストの状態をリセットしますか?(全部「未チェック」に戻ります)",
      )
    )
      return;
    const reset: typeof checkedMap = {};
    ingredients.forEach((_, i) => {
      reset[i] = false;
    });
    setCheckedMap(reset);
    try {
      await supabase
        .schema(DB_SCHEMA)
        .from("recipe_shopping_state")
        .delete()
        .eq("recipe_id", recipe.id);
      toast.success("リストをリセットしました");
    } catch {
      toast.error("リセットに失敗しました");
    }
  };

  const totalCount = ingredients.length;
  const checkedCount = Object.values(checkedMap).filter(Boolean).length;

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-5 pb-24 space-y-5 max-w-3xl">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/recipes/${recipe.id}`)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <PageHeader title="買い物リスト" description={recipe.title} />
        </div>

        {/* 人数 + サマリ + マイクロコピー */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">人数</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setServings((s) => Math.max(1, s - 1))}
                  aria-label="人数を減らす"
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="text-sm font-semibold tabular-nums w-8 text-center">
                  {servings}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setServings((s) => Math.min(20, s + 1))}
                  aria-label="人数を増やす"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {checkedCount}/{totalCount} チェック済
              </span>
              {saving && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  保存中
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              すでに家にある or 買ったらタップしてチェック。チェックは自動で保存されます。
            </p>
          </CardContent>
        </Card>

        {/* 食材リスト (グループ別) */}
        {totalCount === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              食材情報がありません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.group} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length}品
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map(({ index, ingredient: ing }) => {
                    const checked = !!checkedMap[index];
                    const amountText = scaleAmountText(
                      ing.amount,
                      ing.unit,
                      ratio,
                    );
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleChecked(index)}
                        className={cn(
                          "w-full text-left flex items-center gap-3 px-3 py-3 rounded-md border transition-colors",
                          checked
                            ? "bg-primary/5 border-primary/30"
                            : "bg-card border-border hover:bg-muted",
                        )}
                      >
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
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              checked && "line-through text-muted-foreground",
                            )}
                          >
                            {ing.name}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-sm tabular-nums shrink-0",
                            checked && "line-through text-muted-foreground",
                          )}
                        >
                          {amountText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* リストクリアボタン */}
        {totalCount > 0 && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearList}
              className="gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              リストをクリア
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
