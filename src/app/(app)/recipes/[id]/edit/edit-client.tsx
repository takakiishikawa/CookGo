"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, UtensilsCrossed } from "lucide-react";
import {
  Button,
  PageHeader,
  Card,
  CardContent,
  toast,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { RecipeEditor } from "@/components/recipe-editor";
import type { Recipe } from "@/types/database";
import type { DraftRecipe } from "@/types/api";

function recipeToDraft(r: Recipe): DraftRecipe {
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
    ingredients: (r.ingredients ?? []).map((ing) => ({
      ...ing,
      unit: ing.unit ?? "",
    })),
    steps: (r.steps ?? []).map((s, i) => ({ ...s, order: s.order ?? i + 1 })),
  };
}

export function EditRecipeClient({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(recipe.image_url);
  const [regenerating, setRegenerating] = useState(false);

  const regenerateImage = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/regenerate-image`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImageUrl(data.image_url ?? null);
      toast.success(
        data.image_url ? "画像を再生成しました" : "画像を取得できませんでした",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "再生成に失敗しました");
    } finally {
      setRegenerating(false);
    }
  };

  const save = async (draft: DraftRecipe) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/recipes/save?id=${recipe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe: draft,
          source_tag: draft.source_tag ?? recipe.source_tag ?? "self",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("更新しました");
      router.push(`/recipes/${recipe.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

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
          <PageHeader title="レシピ編集" description={recipe.title} />
        </div>

        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={recipe.title}
                width={96}
                height={64}
                unoptimized
                className="w-24 h-16 rounded-md object-cover bg-muted"
              />
            ) : (
              <div className="w-24 h-16 rounded-md bg-surface-subtle flex items-center justify-center">
                <UtensilsCrossed
                  className="w-5 h-5 text-muted-foreground"
                  strokeWidth={1.5}
                />
              </div>
            )}
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">レシピ画像</p>
              <p className="text-sm">
                {imageUrl ? "Unsplashから取得済み" : "未取得"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={regenerateImage}
              disabled={regenerating}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`}
              />
              {regenerating ? "取得中..." : "画像を再生成"}
            </Button>
          </CardContent>
        </Card>

        <RecipeEditor
          initial={recipeToDraft(recipe)}
          saving={saving}
          saveLabel="更新"
          onSave={save}
          onCancel={() => router.push(`/recipes/${recipe.id}`)}
          cancelLabel="戻る"
        />
      </div>
    </div>
  );
}
