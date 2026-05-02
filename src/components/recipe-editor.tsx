"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Camera,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DndProvider,
  DragHandle,
  Input,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SortableItem,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  toast,
} from "@takaki/go-design-system";
import { IngredientThumb } from "@/components/recipe/ingredient-thumb";
import { StepImage } from "@/components/recipe/step-image";
import type { DraftRecipe } from "@/types/api";
import type {
  RecipeIngredient,
  RecipeSourceTag,
  RecipeStep,
} from "@/types/database";

const INGREDIENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "protein", label: "タンパク源" },
  { value: "vegetable", label: "野菜" },
  { value: "carb", label: "炭水化物" },
  { value: "seasoning", label: "調味料" },
  { value: "other", label: "その他" },
];

const UNIT_OPTIONS = ["g", "ml", "個", "本", "枚", "片", "杯", "適量"];

type StepDraft = RecipeStep & { _uid: string };
type IngredientDraft = RecipeIngredient & { _uid: string };

let uidCounter = 0;
const nextUid = () => `uid-${Date.now()}-${++uidCounter}`;

interface RecipeEditorProps {
  initial: DraftRecipe;
  saving?: boolean;
  saveLabel?: string;
  onSave: (recipe: DraftRecipe) => Promise<void> | void;
  onCancel?: () => void;
  cancelLabel?: string;
  recipeId: string;
  imageUrl: string | null;
  onPickImageFile: (file: File) => Promise<void> | void;
  onRegenerateImage: () => Promise<void> | void;
  uploading?: boolean;
  regeneratingImage?: boolean;
}

export function RecipeEditor({
  initial,
  saving = false,
  saveLabel = "保存",
  onSave,
  onCancel,
  cancelLabel = "キャンセル",
  recipeId,
  imageUrl,
  onPickImageFile,
  onRegenerateImage,
  uploading = false,
  regeneratingImage = false,
}: RecipeEditorProps) {
  const initialStepCount = initial.steps.length;
  const [draft, setDraft] = useState<DraftRecipe>(() => ({
    ...initial,
    servings: 1,
  }));
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    initial.ingredients.map((ing) => ({ ...ing, _uid: nextUid() })),
  );
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    initial.steps.map((s) => ({ ...s, _uid: nextUid() })),
  );
  const [regeneratingStep, setRegeneratingStep] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stepIds = useMemo(() => steps.map((s) => s._uid), [steps]);

  const setField = <K extends keyof DraftRecipe>(
    key: K,
    value: DraftRecipe[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const setIngredient = (uid: string, patch: Partial<RecipeIngredient>) => {
    setIngredients((prev) =>
      prev.map((it) => (it._uid === uid ? { ...it, ...patch } : it)),
    );
  };

  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      {
        _uid: nextUid(),
        name: "",
        name_en: null,
        name_vi: null,
        amount: "",
        unit: "g",
        category: "other",
      },
    ]);
  };

  const removeIngredient = (uid: string) => {
    setIngredients((prev) => prev.filter((it) => it._uid !== uid));
  };

  const setStep = (uid: string, patch: Partial<RecipeStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s._uid === uid ? { ...s, ...patch } : s)),
    );
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        _uid: nextUid(),
        order: prev.length + 1,
        text: "",
        image_query: null,
      },
    ]);
  };

  const removeStep = (uid: string) => {
    setSteps((prev) =>
      prev
        .filter((s) => s._uid !== uid)
        .map((s, i) => ({ ...s, order: i + 1 })),
    );
  };

  const reorderSteps = (orderedIds: string[]) => {
    setSteps((prev) => {
      const map = new Map(prev.map((s) => [s._uid, s]));
      const next = orderedIds
        .map((id) => map.get(id))
        .filter((s): s is StepDraft => Boolean(s))
        .map((s, i) => ({ ...s, order: i + 1 }));
      return next;
    });
  };

  const regenerateStepImage = async (uid: string) => {
    const idx = steps.findIndex((s) => s._uid === uid);
    if (idx < 0) return;
    if (idx >= initialStepCount) {
      toast.info("保存後に再生成できます");
      return;
    }
    setRegeneratingStep(idx);
    try {
      const res = await fetch(
        `/api/recipes/${recipeId}/regenerate-step-image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepIndex: idx }),
        },
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStep(uid, { image_query: data.image_query });
      toast.success("画像を更新しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setRegeneratingStep(null);
    }
  };

  const handleFilePicked = (file: File | undefined) => {
    if (!file) return;
    void onPickImageFile(file);
    if (fileRef.current) fileRef.current.value = "";
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
      ingredients: ingredients
        .map(({ _uid: _u, ...i }) => ({ ...i, name: i.name.trim() }))
        .filter((i) => i.name),
      steps: steps
        .map(({ _uid: _u, ...s }, i) => ({ ...s, order: i + 1 }))
        .filter((s) => s.text.trim()),
    });
  };

  return (
    <div className="space-y-6">
      {/* 画像 */}
      <Section title="画像">
        <div className="flex items-center gap-4">
          <div className="relative w-32 h-32 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt="レシピ画像"
                fill
                sizes="128px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <UtensilsCrossed
                  className="w-8 h-8 text-muted-foreground/40"
                  strokeWidth={1.5}
                />
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFilePicked(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-1.5 right-1.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 backdrop-blur text-white hover:bg-black/80 transition-colors disabled:opacity-50"
              aria-label="写真を変更"
              title="写真を変更"
            >
              {uploading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRegenerateImage()}
              disabled={regeneratingImage}
              className="gap-1.5 self-start"
            >
              {regeneratingImage ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {regeneratingImage ? "取得中..." : "別の画像にする"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="gap-1.5 self-start"
            >
              <Camera className="w-3.5 h-3.5" />
              端末から選ぶ
            </Button>
          </div>
        </div>
      </Section>

      {/* 基本情報 */}
      <Section title="基本情報">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">料理名</label>
            <Input
              value={draft.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="例: 豚の生姜焼き"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">説明</label>
            <Textarea
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="どんな料理か簡単に"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">種類</label>
            <ToggleGroup
              type="single"
              value={draft.source_tag ?? "self"}
              onValueChange={(v) => {
                if (v) setField("source_tag", v as RecipeSourceTag);
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="self">自作</ToggleGroupItem>
              <ToggleGroupItem value="ai_suggest">AI 提案</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </Section>

      {/* 食材 */}
      <Section
        title="食材"
        actions={
          <Button size="sm" variant="outline" onClick={addIngredient}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            追加
          </Button>
        }
      >
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">食材がありません</p>
        ) : (
          <div className="space-y-2">
            {ingredients.map((ing) => (
              <Card key={ing._uid} className="border-border">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <IngredientThumb ingredient={ing} size="sm" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="食材名"
                          value={ing.name}
                          onChange={(e) =>
                            setIngredient(ing._uid, { name: e.target.value })
                          }
                          className="flex-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeIngredient(ing._uid)}
                          aria-label="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          inputMode="decimal"
                          value={ing.amount}
                          onChange={(e) =>
                            setIngredient(ing._uid, { amount: e.target.value })
                          }
                          placeholder="量"
                          className="w-20 text-right"
                        />
                        <Select
                          value={ing.unit ?? ""}
                          onValueChange={(v) =>
                            setIngredient(ing._uid, { unit: v })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue placeholder="単位" />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={ing.category ?? "other"}
                          onValueChange={(v) =>
                            setIngredient(ing._uid, { category: v })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INGREDIENT_CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* 作り方 */}
      <Section
        title="作り方"
        actions={
          <Button size="sm" variant="outline" onClick={addStep}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            ステップ追加
          </Button>
        }
      >
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">手順がありません</p>
        ) : (
          <DndProvider items={stepIds} onReorder={reorderSteps}>
            <div className="space-y-2">
              {steps.map((step, i) => {
                const canRegenerate = i < initialStepCount;
                return (
                  <SortableItem key={step._uid} id={step._uid}>
                    <Card className="border-border">
                      <CardContent className="p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <DragHandle aria-label="並び替え" />
                          <Badge variant="secondary">#{i + 1}</Badge>
                          <div className="flex-1" />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeStep(step._uid)}
                            aria-label="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          rows={3}
                          value={step.text}
                          onChange={(e) =>
                            setStep(step._uid, { text: e.target.value })
                          }
                          placeholder="手順を書く"
                        />
                        <StepImage
                          query={step.image_query}
                          onRegenerate={
                            canRegenerate
                              ? () => regenerateStepImage(step._uid)
                              : undefined
                          }
                          regenerating={regeneratingStep === i}
                        />
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground select-none">
                            画像検索ワード(英語)
                          </summary>
                          <Input
                            className="mt-2"
                            value={step.image_query ?? ""}
                            onChange={(e) =>
                              setStep(step._uid, {
                                image_query: e.target.value,
                              })
                            }
                            placeholder="例: pouring egg into hot oatmeal"
                          />
                        </details>
                      </CardContent>
                    </Card>
                  </SortableItem>
                );
              })}
            </div>
          </DndProvider>
        )}
      </Section>

      {/* アクション (右寄せ通常幅) */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button size="sm" onClick={submit} disabled={saving} className="gap-1.5">
          {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          {saving ? "保存中..." : saveLabel}
        </Button>
      </div>
    </div>
  );
}
