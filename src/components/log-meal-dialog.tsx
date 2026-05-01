"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  toast,
} from "@takaki/go-design-system";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type MealType,
  type Recipe,
  type FoodLogIngredientOverride,
} from "@/types/database";

function todayStr(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

interface LogMealDialogProps {
  recipe: Recipe | null;
  defaultMealType?: MealType;
  defaultDate?: string;
  onClose: () => void;
  onLogged?: () => void;
}

export function LogMealDialog({
  recipe,
  defaultMealType = "dinner",
  defaultDate,
  onClose,
  onLogged,
}: LogMealDialogProps) {
  const [mealType, setMealType] = useState<MealType>(defaultMealType);
  const [date, setDate] = useState<string>(defaultDate ?? todayStr());
  const [showDetails, setShowDetails] = useState(false);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!recipe) return;
    setMealType(defaultMealType);
    setDate(defaultDate ?? todayStr());
    setShowDetails(false);
    const initial: Record<number, string> = {};
    (recipe.ingredients ?? []).forEach((ing, i) => {
      initial[i] = ing.amount ?? "";
    });
    setAmounts(initial);
  }, [recipe, defaultMealType, defaultDate]);

  const overrides = useMemo<FoodLogIngredientOverride[]>(() => {
    if (!recipe?.ingredients) return [];
    const list: FoodLogIngredientOverride[] = [];
    recipe.ingredients.forEach((ing, i) => {
      if ((ing.unit ?? "") !== "g") return;
      const baseAmount = Number(ing.amount) || 0;
      const next = Number(amounts[i]) || 0;
      if (next === baseAmount) return;
      list.push({
        index: i,
        amount: String(next),
        unit: "g",
      });
    });
    return list;
  }, [recipe, amounts]);

  const submit = async () => {
    if (!recipe) return;
    setSubmitting(true);
    try {
      const body = {
        recipe_id: recipe.id,
        logged_date: date,
        meal_type: mealType,
        servings: 1,
        overrides:
          overrides.length > 0 ? { ingredients: overrides } : null,
      };
      const res = await fetch("/api/food-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onLogged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "記録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const adjustAmount = (i: number, delta: number) => {
    setAmounts((prev) => {
      const cur = Number(prev[i]) || 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [i]: String(next) };
    });
  };

  return (
    <Dialog
      open={!!recipe}
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>食事を追加</DialogTitle>
          {recipe && <DialogDescription>{recipe.title}</DialogDescription>}
        </DialogHeader>

        {recipe && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">食事タイプ</label>
              <Select
                value={mealType}
                onValueChange={(v) => setMealType(v as MealType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {MEAL_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">日付</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
              />
            </div>

            {(recipe.ingredients?.some((i) => (i.unit ?? "") === "g") ?? false) && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDetails((s) => !s)}
                  className="text-xs text-primary hover:underline"
                >
                  {showDetails ? "− 食材を閉じる" : "+ 食材を微修正"}
                </button>
                {showDetails && (
                  <div className="mt-2 space-y-1.5">
                    {recipe.ingredients?.map((ing, i) =>
                      (ing.unit ?? "") === "g" ? (
                        <Card key={i} className="border-border">
                          <CardContent className="p-2 flex items-center gap-2">
                            <span className="text-xs flex-1 truncate">
                              {ing.name}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => adjustAmount(i, -10)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              className="w-20 text-center"
                              type="number"
                              value={amounts[i] ?? ""}
                              onChange={(e) =>
                                setAmounts((prev) => ({
                                  ...prev,
                                  [i]: e.target.value,
                                }))
                              }
                            />
                            <span className="text-xs">g</span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => adjustAmount(i, 10)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </CardContent>
                        </Card>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={submitting}
              >
                キャンセル
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                onClick={submit}
                disabled={submitting}
              >
                {submitting && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                {submitting ? "追加中..." : "追加"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
