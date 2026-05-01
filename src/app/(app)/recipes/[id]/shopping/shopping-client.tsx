"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  RefreshCw,
  ShoppingCart,
  X,
} from "lucide-react";
import {
  Badge,
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

const SCALABLE_UNITS = new Set([
  "g",
  "kg",
  "ml",
  "l",
  "個",
  "本",
  "枚",
  "片",
  "切れ",
  "尾",
  "玉",
  "房",
  "袋",
  "缶",
  "丁",
  "杯",
]);

function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function scaleAmount(ing: RecipeIngredient, ratio: number): string {
  const unit = (ing.unit ?? "").trim();
  const raw = (ing.amount ?? "").trim();
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0 && SCALABLE_UNITS.has(unit)) {
    return `${formatAmount(numeric * ratio)}${unit}`;
  }
  return unit ? `${raw}${unit}` : raw;
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

  // index ごとの状態を Map で管理 (default: is_needed=true, is_purchased=false)
  const [itemState, setItemState] = useState<
    Record<number, { is_needed: boolean; is_purchased: boolean }>
  >(() => {
    const initial: Record<number, { is_needed: boolean; is_purchased: boolean }> =
      {};
    ingredients.forEach((_, i) => {
      const found = initialItems.find((s) => s.index === i);
      initial[i] = {
        is_needed: found?.is_needed ?? true,
        is_purchased: found?.is_purchased ?? false,
      };
    });
    return initial;
  });

  // デバウンス保存
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [saving, setSaving] = useState(false);

  const persistState = async (next: typeof itemState) => {
    setSaving(true);
    try {
      const items: RecipeShoppingStateItem[] = Object.entries(next).map(
        ([idx, v]) => ({
          index: Number(idx),
          is_needed: v.is_needed,
          is_purchased: v.is_purchased,
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
    saveTimer.current = setTimeout(() => persistState(itemState), 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemState]);

  const toggleNeeded = (i: number) => {
    setItemState((prev) => ({
      ...prev,
      [i]: {
        ...prev[i],
        is_needed: !prev[i]?.is_needed,
        // 買わないに切り替えた時は購入済みもリセット
        is_purchased: !prev[i]?.is_needed ? false : prev[i].is_purchased,
      },
    }));
  };

  const togglePurchased = (i: number) => {
    setItemState((prev) => ({
      ...prev,
      [i]: { ...prev[i], is_purchased: !prev[i]?.is_purchased },
    }));
  };

  const clearList = async () => {
    if (!confirm("買い物リストの状態をリセットしますか？(全部「買う・未購入」に戻ります)")) return;
    const reset: typeof itemState = {};
    ingredients.forEach((_, i) => {
      reset[i] = { is_needed: true, is_purchased: false };
    });
    setItemState(reset);
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

  const neededCount = Object.values(itemState).filter((v) => v.is_needed).length;
  const purchasedCount = Object.values(itemState).filter(
    (v) => v.is_needed && v.is_purchased,
  ).length;

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
          <PageHeader
            title="買い物リスト"
            description={recipe.title}
          />
        </div>

        {/* 人数 + サマリ */}
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-4">
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
            <Badge variant="secondary" className="gap-1">
              <ShoppingCart className="w-3 h-3" />
              買う {neededCount}品
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Check className="w-3 h-3" />
              購入済 {purchasedCount}/{neededCount}
            </Badge>
            {saving && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                保存中
              </span>
            )}
          </CardContent>
        </Card>

        {/* 食材リスト */}
        {ingredients.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              食材情報がありません
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {ingredients.map((ing, i) => {
              const state = itemState[i] ?? { is_needed: true, is_purchased: false };
              const amountText = scaleAmount(ing, ratio);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-md border transition-colors",
                    !state.is_needed
                      ? "bg-muted/30 border-border/50 opacity-50"
                      : state.is_purchased
                        ? "bg-primary/5 border-primary/30"
                        : "bg-card border-border",
                  )}
                >
                  {/* 買った チェック */}
                  <button
                    type="button"
                    onClick={() => togglePurchased(i)}
                    disabled={!state.is_needed}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0",
                      state.is_purchased
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/40 hover:border-primary",
                      !state.is_needed && "opacity-40 cursor-not-allowed",
                    )}
                    aria-label={state.is_purchased ? "購入済を取り消す" : "購入済にする"}
                  >
                    {state.is_purchased && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* 食材名 + 3言語 */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        state.is_purchased && "line-through text-muted-foreground",
                      )}
                    >
                      {ing.name}
                    </p>
                    {(ing.name_en || ing.name_vi) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[ing.name_en, ing.name_vi].filter(Boolean).join(" / ")}
                      </p>
                    )}
                  </div>

                  {/* 量 */}
                  <span
                    className={cn(
                      "text-sm tabular-nums shrink-0",
                      state.is_purchased && "line-through text-muted-foreground",
                    )}
                  >
                    {amountText}
                  </span>

                  {/* 買う / 買わない トグル */}
                  <button
                    type="button"
                    onClick={() => toggleNeeded(i)}
                    className={cn(
                      "ml-1 p-1.5 rounded-md transition-colors flex-shrink-0",
                      state.is_needed
                        ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/10",
                    )}
                    aria-label={state.is_needed ? "買わないにする" : "買うに戻す"}
                    title={state.is_needed ? "買わない" : "買う"}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* リストクリアボタン */}
        {ingredients.length > 0 && (
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
