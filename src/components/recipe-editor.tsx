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
  Input,
  Section,
  Textarea,
  toast,
} from "@takaki/go-design-system";
import { AddIngredientDialog } from "@/components/recipe/add-ingredient-dialog";
import { IngredientThumb } from "@/components/recipe/ingredient-thumb";
import { StepImage } from "@/components/recipe/step-image";
import { groupIngredients } from "@/lib/ingredient-categories";
import { cn } from "@/lib/utils";
import type { DraftRecipe } from "@/types/api";
import type { RecipeIngredient, RecipeStep } from "@/types/database";

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
  const [addIngOpen, setAddIngOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const addIngredientFromDialog = (ing: RecipeIngredient) => {
    setIngredients((prev) => [...prev, { ...ing, _uid: nextUid() }]);
  };

  const removeIngredient = (uid: string) => {
    setIngredients((prev) => prev.filter((it) => it._uid !== uid));
  };

  const groupedIngredients = useMemo(() => {
    const byUid = new Map(ingredients.map((it) => [it._uid, it]));
    const groups = groupIngredients(ingredients);
    return groups.map((g) => ({
      ...g,
      items: g.items.map((item) => {
        const draftItem = ingredients[item.index];
        return { uid: draftItem._uid, ingredient: byUid.get(draftItem._uid)! };
      }),
    }));
  }, [ingredients]);

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
      {/* ===== ヘッダー (画像 + タイトル/説明 input) ===== */}
      <div className="flex gap-4 items-start">
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt="レシピ画像"
              fill
              sizes="(min-width: 640px) 160px, 128px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UtensilsCrossed
                className="w-10 h-10 text-muted-foreground/40"
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
            onClick={() => onRegenerateImage()}
            disabled={regeneratingImage}
            className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/75 transition-colors disabled:opacity-50"
            aria-label="別の画像にする"
            title="別の画像にする"
          >
            {regeneratingImage ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-1.5 right-1.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 backdrop-blur text-white hover:bg-black/80 transition-colors disabled:opacity-50"
            aria-label="端末から選ぶ"
            title="端末から選ぶ"
          >
            {uploading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <Input
            value={draft.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="料理名"
            className="text-lg md:text-xl font-semibold"
          />
          <Textarea
            rows={3}
            value={draft.description ?? ""}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="説明"
          />
        </div>
      </div>

      {/* ===== 食材 ===== */}
      <Section
        title="食材"
        actions={
          <Button size="sm" variant="outline" onClick={() => setAddIngOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            追加
          </Button>
        }
      >
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">食材がありません</p>
        ) : (
          <div className="space-y-5">
            {groupedIngredients.map((group) => (
              <div key={group.group} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm font-semibold">{group.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length}品
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.items.map(({ uid, ingredient: ing }) => (
                    <Card key={uid} className="border-border">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <IngredientThumb
                            ingredient={ing}
                            size="xl"
                            regenerable
                          />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <Input
                              placeholder="食材名"
                              value={ing.name}
                              onChange={(e) =>
                                setIngredient(uid, { name: e.target.value })
                              }
                              className="h-8"
                            />
                            <div className="flex items-center gap-2">
                              <Input
                                inputMode="decimal"
                                value={ing.amount}
                                onChange={(e) =>
                                  setIngredient(uid, {
                                    amount: e.target.value,
                                  })
                                }
                                placeholder="量"
                                className="h-8 flex-1"
                              />
                              {ing.unit && (
                                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                  {ing.unit}
                                </span>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeIngredient(uid)}
                                aria-label="削除"
                                className="h-8 w-8 flex-shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ===== 作り方 ===== */}
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
          <div className="space-y-3">
            {steps.map((step, i) => {
              const canRegenerate = i < initialStepCount;
              return (
                <Card key={step._uid} className="border-border">
                  <CardContent className={cn("p-3 space-y-3")}>
                    <div className="flex items-center gap-2">
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
                      directUrl={step.image_url ?? null}
                      onRegenerate={
                        canRegenerate
                          ? () => regenerateStepImage(step._uid)
                          : undefined
                      }
                      regenerating={regeneratingStep === i}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <AddIngredientDialog
        open={addIngOpen}
        onOpenChange={setAddIngOpen}
        onSubmit={addIngredientFromDialog}
      />

      {/* ===== アクション (右寄せ通常幅) ===== */}
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
