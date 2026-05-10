"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
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
    scene: r.scene,
    genre_tags: r.genre_tags ?? [],
    nutrition_tags: r.nutrition_tags ?? [],
  };
}

export function ShoppingClient({
  recipe,
  initialItems,
  initialServings,
}: ShoppingClientProps) {
  const supabase = createClient();
  const router = useRouter();
  const baseServings = Math.max(1, recipe.servings || 1);
  const seedIngredients = (recipe.ingredients as RecipeIngredient[]) ?? [];

  // 食材は server prop からだけでなく、編集モード中の追加/編集/削除も
  // ローカルで反映できるよう state にコピー
  const [ingredients, setIngredients] =
    useState<RecipeIngredient[]>(seedIngredients);

  const [servings, setServings] = useState<number>(initialServings);
  const ratio = useMemo(() => servings / baseServings, [servings, baseServings]);

  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    seedIngredients.forEach((_, i) => {
      const found = initialItems.find((s) => s.index === i);
      initial[i] = found
        ? found.is_purchased || found.is_needed === false
        : false;
    });
    return initial;
  });

  // ===== 編集モード関連 =====
  const [editMode, setEditMode] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  // 編集モード入り時のスナップショット (キャンセル用)
  const snapshot = useRef<{
    ingredients: RecipeIngredient[];
    checkedMap: Record<number, boolean>;
  } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);

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
    setCheckedMap((prev) => ({ ...prev, [newIdx]: false }));
  };

  const handleEditSubmit = (ing: RecipeIngredient) => {
    if (editIdx === null) return;
    const idx = editIdx;
    setIngredients((prev) => prev.map((p, i) => (i === idx ? ing : p)));
    setEditIdx(null);
  };

  const handleDelete = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
    // checkedMap のキーをシフト
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
      // 食材インデックス変更後の checkedMap も即座に永続化
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
          // 編集モード中は購入済みでも表示する (まとめて操作するため)
          items: editMode
            ? g.items
            : g.items.filter((it) => !checkedMap[it.index]),
        }))
        .filter((g) => g.items.length > 0),
    [groups, checkedMap, editMode],
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
    // 編集モード中はチェック切り替えできないので debounce 永続化を無効化
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

  const renderItem = (index: number, ing: RecipeIngredient) => {
    const checked = !!checkedMap[index];
    const amountText = scaleAmountText(ing.amount, ing.unit, ratio);
    const interactive = !editMode;
    return (
      <div
        key={index}
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
          "w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          editMode
            ? "bg-card border-border"
            : checked
              ? "bg-primary/5 border-primary/40 cursor-pointer"
              : "bg-card border-border hover:bg-muted cursor-pointer",
        )}
      >
        <IngredientThumb ingredient={ing} size="md" regenerable={!editMode} />
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                "text-sm font-medium truncate flex-1",
                !editMode && checked && "line-through text-muted-foreground",
              )}
            >
              {ing.name}
            </p>
            <p
              className={cn(
                "text-xs tabular-nums whitespace-nowrap flex-shrink-0",
                !editMode && checked
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
                !editMode && checked && "line-through",
              )}
            >
              {ing.name_en}
            </p>
          )}
          {ing.name_vi && (
            <p
              className={cn(
                "text-sm truncate text-muted-foreground/70",
                !editMode && checked && "line-through",
              )}
            >
              {ing.name_vi}
            </p>
          )}
        </div>
        {editMode ? (
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
        ) : (
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
        )}
      </div>
    );
  };

  const totalCount = ingredients.length;
  const checkedCount = useMemo(
    () => Object.values(checkedMap).filter(Boolean).length,
    [checkedMap],
  );
  const allDone =
    !editMode && totalCount > 0 && checkedCount === totalCount;

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

        {/* 進捗 + 人数 (購入済み/家にあるどちらでもチェック=「そろった」) */}
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

        {/* 食材リスト (グループ別 + PC 2列) */}
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
      </div>

      {/* 追加ダイアログ */}
      <AddIngredientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleAdd}
      />
      {/* 編集ダイアログ (initial を渡すと編集モード) */}
      <AddIngredientDialog
        open={editIdx !== null}
        onOpenChange={(o) => {
          if (!o) setEditIdx(null);
        }}
        onSubmit={handleEditSubmit}
        initial={editIdx !== null ? ingredients[editIdx] : null}
      />
    </div>
  );
}
