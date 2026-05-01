"use client";

import { useId, useState } from "react";
import { GripVertical, Minus, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Card,
  CardContent,
  Section,
  Badge,
  toast,
} from "@takaki/go-design-system";
import type { DraftRecipe } from "@/types/api";
import type {
  RecipeIngredient,
  RecipeStep,
  PantryItem,
} from "@/types/database";

const INGREDIENT_CATEGORIES = [
  { value: "protein", label: "タンパク源" },
  { value: "vegetable", label: "野菜" },
  { value: "carb", label: "炭水化物" },
  { value: "seasoning", label: "調味料" },
  { value: "other", label: "その他" },
];

interface RecipeEditorProps {
  initial: DraftRecipe;
  saving?: boolean;
  saveLabel?: string;
  onSave: (recipe: DraftRecipe) => Promise<void> | void;
  onCancel?: () => void;
  cancelLabel?: string;
  pantryItems?: PantryItem[];
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function RecipeEditor({
  initial,
  saving = false,
  saveLabel = "保存",
  onSave,
  onCancel,
  cancelLabel = "キャンセル",
  pantryItems = [],
}: RecipeEditorProps) {
  const [draft, setDraft] = useState<DraftRecipe>(() => ({
    ...initial,
    servings: 1,
  }));
  const datalistId = useId();

  const setField = <K extends keyof DraftRecipe>(
    key: K,
    value: DraftRecipe[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const setIngredient = (index: number, ing: RecipeIngredient) => {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((it, i) => (i === index ? ing : it)),
    }));
  };

  const addIngredient = () => {
    setDraft((d) => ({
      ...d,
      ingredients: [
        ...d.ingredients,
        {
          name: "",
          name_en: null,
          name_vi: null,
          amount: "",
          unit: "g",
          in_pantry: false,
          category: "other",
        },
      ],
    }));
  };

  const removeIngredient = (index: number) => {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.filter((_, i) => i !== index),
    }));
  };

  const setAmount = (index: number, nextAmountStr: string) => {
    const ing = draft.ingredients[index];
    if (!ing) return;
    setIngredient(index, { ...ing, amount: nextAmountStr });
  };

  const adjustAmountG = (index: number, delta: number) => {
    const ing = draft.ingredients[index];
    if (!ing || (ing.unit ?? "") !== "g") return;
    const current = num(Number(ing.amount));
    const next = Math.max(0, current + delta);
    setAmount(index, String(next));
  };

  const setStep = (index: number, step: RecipeStep) => {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, i) => (i === index ? step : s)),
    }));
  };

  const addStep = () => {
    setDraft((d) => ({
      ...d,
      steps: [
        ...d.steps,
        { order: d.steps.length + 1, text: "", image_query: null },
      ],
    }));
  };

  const removeStep = (index: number) => {
    setDraft((d) => ({
      ...d,
      steps: d.steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, order: i + 1 })),
    }));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    setDraft((d) => {
      const next = [...d.steps];
      const j = index + dir;
      if (j < 0 || j >= next.length) return d;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...d, steps: next.map((s, i) => ({ ...s, order: i + 1 })) };
    });
  };

  const submit = async () => {
    if (!draft.title.trim()) {
      toast.error("料理名は必須です");
      return;
    }
    await onSave({
      ...draft,
      title: draft.title.trim(),
      title_en: draft.title_en?.trim() || null,
      servings: 1,
      is_meal_prep_friendly: false,
      meal_prep_days: null,
      ingredients: draft.ingredients
        .map((i) => ({ ...i, name: i.name.trim() }))
        .filter((i) => i.name),
      steps: draft.steps
        .map((s, i) => ({ ...s, order: i + 1 }))
        .filter((s) => s.text.trim()),
    });
  };

  return (
    <div className="space-y-6">
      <Section title="基本情報">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">料理名</label>
            <Input
              value={draft.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="例: 豚の生姜焼き"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">説明(任意)</label>
            <Textarea
              rows={2}
              value={draft.description ?? ""}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>

          {/* 種類タグ */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">種類</label>
            <div className="flex gap-1.5">
              {(["self", "ai_suggest", "delivery"] as const).map((tag) => {
                const active = (draft.source_tag ?? "self") === tag;
                const label =
                  tag === "self"
                    ? "自作"
                    : tag === "ai_suggest"
                      ? "AI提案"
                      : "宅配";
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setField("source_tag", tag)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-primary text-white border-primary"
                        : "bg-surface-subtle text-foreground border-border"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-subtle border border-border rounded-md px-3 py-2 max-w-[12rem]">
            <p className="text-xs text-muted-foreground">調理時間</p>
            <p className="text-sm font-semibold">
              {draft.prep_time_min ?? "-"}分
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="食材"
        actions={
          <Button size="sm" variant="outline" onClick={addIngredient}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            追加
          </Button>
        }
      >
        {pantryItems.length > 0 && (
          <datalist id={datalistId}>
            {pantryItems.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        )}
        <div className="space-y-2">
          {draft.ingredients.length === 0 && (
            <p className="text-sm text-muted-foreground">食材がありません</p>
          )}
          {draft.ingredients.map((ing, i) => {
            const isG = (ing.unit ?? "") === "g";
            return (
              <Card key={i} className="border-border">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="食材名"
                      list={pantryItems.length > 0 ? datalistId : undefined}
                      value={ing.name}
                      onChange={(e) =>
                        setIngredient(i, { ...ing, name: e.target.value })
                      }
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => removeIngredient(i)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 flex items-center gap-1">
                      {isG && (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => adjustAmountG(i, -10)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                      )}
                      <Input
                        value={ing.amount}
                        onChange={(e) => setAmount(i, e.target.value)}
                        placeholder="量"
                        className="text-center"
                      />
                      {isG && (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => adjustAmountG(i, 10)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <Input
                      className="col-span-2"
                      value={ing.unit ?? ""}
                      onChange={(e) =>
                        setIngredient(i, { ...ing, unit: e.target.value })
                      }
                      placeholder="単位"
                    />
                    <select
                      className="col-span-5 text-xs h-9 bg-background border border-border rounded-md px-1"
                      value={ing.category ?? "other"}
                      onChange={(e) =>
                        setIngredient(i, { ...ing, category: e.target.value })
                      }
                    >
                      {INGREDIENT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isG && Number(ing.amount) > 0 && (
                    <div className="px-1">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(500, Number(ing.amount) * 2)}
                        step={5}
                        value={Number(ing.amount) || 0}
                        onChange={(e) => setAmount(i, e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section
        title="作り方"
        actions={
          <Button size="sm" variant="outline" onClick={addStep}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            ステップ追加
          </Button>
        }
      >
        <div className="space-y-2">
          {draft.steps.length === 0 && (
            <p className="text-sm text-muted-foreground">手順がありません</p>
          )}
          {draft.steps.map((step, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">#{i + 1}</Badge>
                  <div className="flex-1" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    title="上へ"
                  >
                    <GripVertical className="w-3.5 h-3.5 -rotate-90" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => moveStep(i, 1)}
                    disabled={i === draft.steps.length - 1}
                    title="下へ"
                  >
                    <GripVertical className="w-3.5 h-3.5 rotate-90" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => removeStep(i)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  value={step.text}
                  onChange={(e) =>
                    setStep(i, { ...step, text: e.target.value })
                  }
                  placeholder="手順を書く"
                />
                <Input
                  value={step.image_query ?? ""}
                  onChange={(e) =>
                    setStep(i, { ...step, image_query: e.target.value })
                  }
                  placeholder="画像検索ワード(英語、任意)"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <div className="flex gap-2 pt-4 sticky bottom-0 bg-background border-t border-border py-3 -mx-4 px-4 md:-mx-8 md:px-8">
        {onCancel && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        )}
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          onClick={submit}
          disabled={saving}
        >
          {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          {saving ? "保存中..." : saveLabel}
        </Button>
      </div>
    </div>
  );
}
