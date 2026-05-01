"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import {
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge,
  toast,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { LogMealDialog } from "@/components/log-meal-dialog";
import { RecipePickerDialog } from "@/components/recipe-picker-dialog";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type FoodLogWithRecipe,
  type MealPlanWithRecipe,
  type MealType,
  type Recipe,
} from "@/types/database";

interface Props {
  initialDate: string;
  initialDateLogs: FoodLogWithRecipe[];
  initialDatePlans: MealPlanWithRecipe[];
  recipes: Recipe[];
}

type Entry = {
  kind: "log" | "plan";
  id: string;
  meal_type: MealType;
  date: string;
  recipe_id: string;
  title: string;
  image_url: string | null;
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function logToEntry(l: FoodLogWithRecipe): Entry {
  return {
    kind: "log",
    id: l.id,
    meal_type: l.meal_type,
    date: l.logged_date,
    recipe_id: l.recipe_id,
    title: l.recipe.title,
    image_url: l.recipe.image_url,
  };
}

function planToEntry(p: MealPlanWithRecipe): Entry {
  return {
    kind: "plan",
    id: p.id,
    meal_type: p.meal_type,
    date: p.planned_date,
    recipe_id: p.recipe_id,
    title: p.recipe.title,
    image_url: p.recipe.image_url,
  };
}

export function DashboardClient({
  initialDate,
  initialDateLogs,
  initialDatePlans,
  recipes,
}: Props) {
  const [date, setDate] = useState(initialDate);
  const [dateLogs, setDateLogs] =
    useState<FoodLogWithRecipe[]>(initialDateLogs);
  const [datePlans, setDatePlans] =
    useState<MealPlanWithRecipe[]>(initialDatePlans);
  const [logTarget, setLogTarget] = useState<{
    recipe: Recipe;
    mealType: MealType;
  } | null>(null);
  const [pickerMealType, setPickerMealType] = useState<MealType | null>(null);

  const isToday = date === todayStr();

  const fetchForDate = async (newDate: string) => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/food-logs?date=${newDate}`).then((r) => r.json()),
        fetch(`/api/plan/week?start=${newDate}&end=${newDate}`).then((r) =>
          r.json(),
        ),
      ]);
      if (r1.error) throw new Error(r1.error);
      setDateLogs(r1.logs as FoodLogWithRecipe[]);
      setDatePlans((r2.plans ?? []) as MealPlanWithRecipe[]);
    } catch {
      toast.error("取得に失敗しました");
    }
  };

  useEffect(() => {
    if (date !== initialDate) fetchForDate(date);
  }, [date, initialDate]);

  const goDay = (delta: number) => setDate((d) => addDays(d, delta));

  const dateEntries: Entry[] = [
    ...dateLogs.map(logToEntry),
    ...datePlans.map(planToEntry),
  ];

  const deleteEntry = async (entry: Entry) => {
    try {
      if (entry.kind === "log") {
        const res = await fetch(`/api/food-logs?id=${entry.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      } else {
        const res = await fetch("/api/plan/map", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: entry.id }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }
      await fetchForDate(date);
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const openRecord = (mealType: MealType) => {
    if (recipes.length === 0) {
      toast.error("先にレシピを登録してください");
      return;
    }
    setPickerMealType(mealType);
  };

  const entriesByMealType = MEAL_TYPES.reduce(
    (acc, mt) => {
      acc[mt] = dateEntries.filter((e) => e.meal_type === mt);
      return acc;
    },
    {} as Record<MealType, Entry[]>,
  );

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-5 pb-8 space-y-6 max-w-5xl">
        <PageHeader title="今日の食事" />

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goDay(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 text-sm border border-border rounded-md px-3 py-2 bg-background text-center"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => goDay(1)}
            disabled={date >= todayStr()}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!isToday && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDate(todayStr())}
            >
              今日
            </Button>
          )}
        </div>

        {/* Today's meals */}
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {MEAL_TYPES.map((mt) => {
              const entries = entriesByMealType[mt];
              return (
                <div key={mt} className="flex items-center gap-2 p-3">
                  <Badge
                    variant="secondary"
                    className="font-semibold w-12 justify-center"
                  >
                    {MEAL_TYPE_LABELS[mt]}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    {entries.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        未登録
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {entries.map((entry) => (
                          <span
                            key={`${entry.kind}-${entry.id}`}
                            className="inline-flex items-center gap-1 text-sm"
                          >
                            <span className="truncate">{entry.title}</span>
                            <button
                              onClick={() => deleteEntry(entry)}
                              className="text-muted-foreground hover:text-destructive"
                              title="削除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => openRecord(mt)}
                    title="追加"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {recipes.length === 0 && (
          <Card>
            <CardContent className="py-6 flex flex-col items-center gap-3">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                まずはレシピを追加しましょう
              </p>
              <Button asChild size="sm">
                <a href="/recipes/new">レシピを追加</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <RecipePickerDialog
        open={pickerMealType !== null}
        recipes={recipes}
        title={
          pickerMealType
            ? `${MEAL_TYPE_LABELS[pickerMealType]}に追加`
            : "レシピを選択"
        }
        onPick={(recipe) => {
          if (pickerMealType) {
            setLogTarget({ recipe, mealType: pickerMealType });
            setPickerMealType(null);
          }
        }}
        onClose={() => setPickerMealType(null)}
      />

      <LogMealDialog
        recipe={logTarget?.recipe ?? null}
        defaultMealType={logTarget?.mealType}
        defaultDate={date}
        onClose={() => setLogTarget(null)}
        onLogged={async () => {
          setLogTarget(null);
          toast.success("追加しました");
          await fetchForDate(date);
        }}
      />
    </div>
  );
}
