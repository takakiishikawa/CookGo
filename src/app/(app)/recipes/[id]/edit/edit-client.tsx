"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, toast } from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { RecipeEditor } from "@/components/recipe-editor";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/constants";
import type { Recipe } from "@/types/database";
import type { DraftRecipe } from "@/types/api";

const MAX_THUMBNAIL_SIZE_MB = 5;

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
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(recipe.image_url);
  const [regenerating, setRegenerating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const cancel = () => router.push(`/recipes/${recipe.id}`);

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
        data.image_url ? "画像を更新しました" : "画像を取得できませんでした",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setRegenerating(false);
    }
  };

  const handlePickImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    if (file.size > MAX_THUMBNAIL_SIZE_MB * 1024 * 1024) {
      toast.error(`${MAX_THUMBNAIL_SIZE_MB}MB以下の画像を選択してください`);
      return;
    }
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");

      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const path = `${user.id}/${recipe.id}-${Date.now()}.${safeExt}`;

      const upload = await supabase.storage
        .from("cookgo-recipes")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw upload.error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("cookgo-recipes").getPublicUrl(path);

      const { error } = await supabase
        .schema(DB_SCHEMA)
        .from("recipes")
        .update({ image_url: publicUrl })
        .eq("id", recipe.id);
      if (error) throw error;

      setImageUrl(publicUrl);
      toast.success("写真を変更しました");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "アップロードに失敗しました",
      );
    } finally {
      setUploading(false);
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
      <AppHeader
        breadcrumbs={[
          { label: "レシピ", href: "/recipes" },
          { label: recipe.title, href: `/recipes/${recipe.id}` },
          { label: "編集" },
        ]}
      />
      <div className="px-4 md:px-8 pt-5 pb-12 space-y-5 max-w-3xl">
        <PageHeader title="レシピ編集" />

        <RecipeEditor
          initial={recipeToDraft(recipe)}
          saving={saving}
          saveLabel="更新"
          onSave={save}
          onCancel={cancel}
          cancelLabel="戻る"
          recipeId={recipe.id}
          imageUrl={imageUrl}
          onPickImageFile={handlePickImageFile}
          onRegenerateImage={regenerateImage}
          uploading={uploading}
          regeneratingImage={regenerating}
        />
      </div>
    </div>
  );
}
