"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Info,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  PageHeader,
  toast,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { IngredientThumb } from "@/components/recipe/ingredient-thumb";
import { AddIngredientDialog } from "@/components/recipe/add-ingredient-dialog";
import { IngredientPopup } from "@/components/ingredient/ingredient-popup";
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
import type { DraftRecipe, RecipeSaveRequest } from "@/types/api";

interface ShoppingClientProps {
  recipe: Recipe;
  initialItems: RecipeShoppingStateItem[];
  inventoryNames: string[];
  hasShoppingState: boolean;
  initialServings: number;
}

function recipeToDraftWithIngredients(
  r: Recipe,
  ingredients: RecipeIngredient[],
): DraftRecipe {
  return {
    title: r.title,
    title_en: r.title_en,
    description: r.description,
    prep_time_min: r.prep_time_min,
    is_meal_prep_friendly: r.is_meal_prep_friendly,
    meal_prep_days: r.meal_prep_days,
    servings: r.servings,
    source_tag: r.source_tag ?? "self",
    source_url: r.source_url,
    image_url: r.image_url,
    ingredients,
    main_ingredient_tag: r.main_ingredient_tag,
    country_tag: r.country_tag,
    nutrition_tags: r.nutrition_tags ?? [],
  };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function ShoppingClient({
  recipe,
  initialItems,
  inventoryNames,
  hasShoppingState,
  initialServings,
}: ShoppingClientProps) {
  const supabase = createClient();
  const router = useRouter();
  const baseServings = Math.max(1, recipe.servings || 1);
  const seedIngredients = (recipe.ingredients as RecipeIngredient[]) ?? [];

  // 在庫名のセット(正規化済み)
  const inventorySet = useMemo(
    () => new Set(inventoryNames.map(normalizeName)),
    [inventoryNames],
  );
  const isInInventory = (ing: RecipeIngredient) =>
    inventorySet.has(normalizeName(ing.name));

  const [ingredients, setIngredients] =
    useState<RecipeIngredient[]>(seedIngredients);

  const [servings, setServings] = useState<number>(initialServings);
  const ratio = useMemo(() => servings / baseServings, [servings, baseServings]);

  // 初回 checkedMap:
  //  - DB に shopping_state がある場合は DB の値が真(ユーザー判断尊重)
  //  - 無い場合は在庫マッチで初期チェック
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    seedIngredients.forEach((ing, i) => {
      if (hasShoppingState) {
        const found = initialItems.find((s) => s.index === i);
        initial[i] = found
          ? found.is_purchased || found.is_needed === false
          : isInInventory(ing);
      } else {
        initial[i] = isInInventory(ing);
      }
    });
    return initial;
  });

  // ===== 編集モード関連 =====
  const [editMode, setEditMode] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const snapshot = useRef<{
    ingredients: RecipeIngredient[];
    checkedMap: Record<number, boolean>;
  } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  // ===== 食材ポップアップ =====
  const [infoIngredient, setInfoIngredient] = useState<RecipeIngredient | null>(
    null,
  );

  const enterEditMode = () => {
    snapshot.current = {
      ingredients: ingredients.map((i) => ({ ...i })),
      checkedMap: { ...checkedMap },
    };
    setEditMode(true);
  };

  const cancelEditMode = () => {
    if (snapshot.current) {
      setIngredients(snapshot.current.ingredients);
      setCheckedMap(snapshot.current.checkedMap);
    }
    snapshot.current = null;
    setEditMode(false);
    setEditIdx(null);
    setAddOpen(false);
  };

  const handleAdd = (ing: RecipeIngredient) => {
    const newIdx = ingredients.length;
    setIngredients((prev) => [...prev, ing]);
    setCheckedMap((prev) => ({ ...prev, [newIdx]: isInInventory(ing) }));
  };

  const handleEditSubmit = (ing: RecipeIngredient) => {
    if (editIdx === null) return;
    const idx = editIdx;
    setIngredients((prev) => prev.map((p, i) => (i === idx ? ing : p)));
    setEditIdx(null);
  };

  const handleDelete = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
    setCheckedMap((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < idx) next[i] = v;
        else if (i > idx) next[i - 1] = v;
      });
      return next;
    });
  };

  const saveEdits = async () => {
    setSavingEdit(true);
    try {
      const draft = recipeToDraftWithIngredients(recipe, ingredients);
      const body: RecipeSaveRequest = {
        recipe: draft,
        source_tag: recipe.source_tag ?? "self",
      };
      const res = await fetch(`/api/recipes/save?id=${recipe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await persistState(checkedMap);
      toast.success("食材リストを更新しました");
      snapshot.current = null;
      setEditMode(false);
      setEditIdx(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSavingEdit(false);
    }
  };

  const groups = useMemo<GroupedIngredients[]>(
    () => groupIngredients(ingredients),
    [ingredients],
  );

  const uncheckedGroups = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: editMode
            ? g.items
            : g.items.filter((it) => !checkedMap[it.index]),
        }))
        .filter((g) => g.items.length > 0),
    [groups, checkedMap, editMode],
  );

  const checkedItems = useMemo(
    () =>
      groups.flatMap((g) => g.items.filter((it) => !!checkedMap[it.index])),
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
    if (editMode) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistState(checkedMap), 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedMap, editMode]);

  const toggleChecked = (i: number) => {
    if (editMode) return;
    setCheckedMap((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  const resetToInitial = () => {
    if (editMode) return;
    const next: Record<number, boolean> = {};
    ingredients.forEach((ing, i) => {
      next[i] = isInInventory(ing);
    });
    setCheckedMap(next);
    toast.success("最初の状態に戻しました");
  };

  const renderItem = (index: number, ing: RecipeIngredient) => {
    const checked = !!checkedMap[index];
    const amountText = scaleAmountText(ing.amount, ing.unit, ratio);
    const interactive = !editMode;

    if (editMode) {
      return (
        <div
          key={index}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border bg-card border-border"
        >
          <IngredientThumb
            ingredient={ing}
            size="md"
            regenerable={false}
            queryContext="supermarket"
          />
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-baseline gap-2">
              <p className="text-base font-medium truncate flex-1 text-foreground">
                {ing.name}
              </p>
              <p className="text-sm tabular-nums whitespace-nowrap flex-shrink-0 text-foreground/70">
                {amountText}
              </p>
            </div>
            {ing.name_en && (
              <p className="text-base truncate text-foreground/80">
                {ing.name_en}
              </p>
            )}
            {ing.name_vi && (
              <p className="text-base truncate text-foreground/80">
                {ing.name_vi}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                setEditIdx(index);
              }}
              aria-label="食材を編集"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(index);
              }}
              aria-label="食材を削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={index}
        className={cn(
          "w-full flex items-stretch rounded-lg border transition-colors",
          checked
            ? "bg-primary/5 border-primary/40"
            : "bg-card border-border",
        )}
      >
        {/* メインエリア: タップでチェック切り替え */}
        <div
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : -1}
          aria-pressed={interactive ? checked : undefined}
          onClick={interactive ? () => toggleChecked(index) : undefined}
          onKeyDown={
            interactive
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleChecked(index);
                  }
                }
              : undefined
          }
          className={cn(
            "flex-1 flex items-center gap-3 px-3 py-3 rounded-l-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !checked && "hover:bg-muted",
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
          <IngredientThumb
            ingredient={ing}
            size="md"
            regenerable={false}
            queryContext="supermarket"
          />
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-baseline gap-2">
              <p
                className={cn(
                  "text-base font-medium truncate flex-1 text-foreground",
                  checked && "line-through opacity-60",
                )}
              >
                {ing.name}
              </p>
              <p
                className={cn(
                  "text-sm tabular-nums whitespace-nowrap flex-shrink-0 text-foreground/70",
                  checked && "line-through opacity-60",
                )}
              >
                {amountText}
              </p>
            </div>
            {ing.name_en && (
              <p
                className={cn(
                  "text-base truncate text-foreground/80",
                  checked && "line-through opacity-60",
                )}
              >
                {ing.name_en}
              </p>
            )}
            {ing.name_vi && (
              <p
                className={cn(
                  "text-base truncate text-foreground/80",
                  checked && "line-through opacity-60",
                )}
              >
                {ing.name_vi}
              </p>
            )}
          </div>
        </div>

        {/* ⓘ ボタン: 食材ポップアップを開く */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setInfoIngredient(ing);
          }}
          aria-label={`${ing.name} の詳細`}
          className="flex items-center justify-center w-12 border-l border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-r-lg transition-colors"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>
    );
  };

  const totalCount = ingredients.length;
  const checkedCount = useMemo(
    () => Object.values(checkedMap).filter(Boolean).length,
    [checkedMap],
  );
  const allDone = !editMode && totalCount > 0 && checkedCount === totalCount;

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
        <div className="flex items-start justify-between gap-3">
          <PageHeader title="買い物" description={recipe.title} />
          {!editMode ? (
            <Button
              size="sm"
              variant="outline"
              onClick={enterEditMode}
              className="gap-1.5 mt-1"
            >
              <Pencil className="w-3.5 h-3.5" />
              編集
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 mt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEditMode}
                disabled={savingEdit}
                className="gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={saveEdits}
                disabled={savingEdit}
                className="gap-1.5"
              >
                {savingEdit && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                {savingEdit ? "保存中" : "保存"}
              </Button>
            </div>
          )}
        </div>

        {/* 進捗 + 人数 */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm tabular-nums">
            {allDone ? (
              <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                <Check className="w-4 h-4" />
                全部そろいました
              </span>
            ) : !editMode && totalCount > 0 ? (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {checkedCount}
                </span>
                {" / "}
                {totalCount}
              </span>
            ) : editMode ? (
              <span className="text-muted-foreground">
                編集モード ({totalCount}品)
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
              disabled={editMode}
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
              disabled={editMode}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
            {saving && (
              <RefreshCw className="ml-2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* 食材リスト */}
        {totalCount === 0 && !editMode ? (
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

            {!editMode && checkedItems.length > 0 && (
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

            {editMode && (
              <Button
                variant="outline"
                onClick={() => setAddOpen(true)}
                className="w-full gap-1.5"
              >
                <Plus className="w-4 h-4" />
                食材を追加
              </Button>
            )}
          </div>
        )}

        {/* 最初に戻すボタン: ユーザー操作のみリセット、在庫由来は維持 */}
        {!editMode && totalCount > 0 && (
          <div className="pt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToInitial}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              最初に戻す
            </Button>
          </div>
        )}
      </div>

      {/* 追加 / 編集ダイアログ */}
      <AddIngredientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleAdd}
      />
      <AddIngredientDialog
        open={editIdx !== null}
        onOpenChange={(o) => {
          if (!o) setEditIdx(null);
        }}
        onSubmit={handleEditSubmit}
        initial={editIdx !== null ? ingredients[editIdx] : null}
      />

      {/* 食材ポップアップ */}
      <IngredientPopup
        ingredient={infoIngredient}
        onOpenChange={(o) => {
          if (!o) setInfoIngredient(null);
        }}
      />
    </div>
  );
}
