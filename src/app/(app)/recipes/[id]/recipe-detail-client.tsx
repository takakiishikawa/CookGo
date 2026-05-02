"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  ExternalLink,
  Pencil,
  RefreshCw,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  Video,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button, Separator, toast } from "@takaki/go-design-system";
import { Recipe, RecipeIngredient, RecipeStep } from "@/types/database";
import { IngredientThumb } from "@/components/recipe/ingredient-thumb";
import { StepImage } from "@/components/recipe/step-image";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/constants";
import { groupStepsIntoPhases } from "@/lib/step-phases";

/** ステップ本文中で言及されている食材を抽出 */
function findStepIngredients(
  text: string,
  ingredients: RecipeIngredient[],
): RecipeIngredient[] {
  if (!text) return [];
  // 名前が長い順に試して、より具体的なマッチを優先
  const sorted = [...ingredients].sort((a, b) => b.name.length - a.name.length);
  const seen = new Set<string>();
  const matched: RecipeIngredient[] = [];
  for (const ing of sorted) {
    if (!ing.name || ing.name.length < 1) continue;
    if (seen.has(ing.name)) continue;
    if (text.includes(ing.name)) {
      matched.push(ing);
      seen.add(ing.name);
    }
  }
  return matched;
}

interface RecipeDetailClientProps {
  recipe: Recipe;
}

const MAX_THUMBNAIL_SIZE_MB = 5;

export function RecipeDetailClient({ recipe }: RecipeDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(recipe.image_url);
  const [uploading, setUploading] = useState(false);
  const [stepsState, setStepsState] = useState<RecipeStep[]>(() =>
    [...((recipe.steps as RecipeStep[]) ?? [])].sort(
      (a, b) => a.order - b.order,
    ),
  );
  const [regeneratingStep, setRegeneratingStep] = useState<number | null>(null);

  const stepPhases = useMemo(
    () => groupStepsIntoPhases(stepsState),
    [stepsState],
  );

  const ingredientsList = useMemo<RecipeIngredient[]>(
    () => (recipe.ingredients as RecipeIngredient[] | null) ?? [],
    [recipe.ingredients],
  );

  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.title + " 作り方")}`;

  const deleteRecipe = async () => {
    if (!confirm(`「${recipe.title}」を削除しますか?`)) return;
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("削除しました");
      router.push("/recipes");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const openShoppingList = () => {
    router.push(`/recipes/${recipe.id}/shopping`);
  };

  const regenerateOneStepImage = async (stepIndex: number) => {
    setRegeneratingStep(stepIndex);
    try {
      const res = await fetch(
        `/api/recipes/${recipe.id}/regenerate-step-image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepIndex }),
        },
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStepsState((prev) =>
        prev.map((s, i) =>
          i === stepIndex ? { ...s, image_query: data.image_query } : s,
        ),
      );
      toast.success("画像を更新しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setRegeneratingStep(null);
    }
  };

  const handleFilePicked = async (file: File) => {
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
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col">
      <AppHeader
        breadcrumbs={[
          { label: "レシピ", href: "/recipes" },
          { label: recipe.title },
        ]}
      />

      <div className="px-4 md:px-8 pt-6 pb-12 space-y-6 max-w-3xl">
        {/* ===== ヘッダー: 画像 + タイトル + 右側プライマリアクション ===== */}
        <div className="flex gap-4 items-start">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={recipe.title}
                fill
                sizes="(min-width: 640px) 160px, 128px"
                priority
                className="object-cover"
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
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFilePicked(f);
              }}
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
          <div className="flex-1 min-w-0 space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold leading-tight">
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {recipe.description}
              </p>
            )}
          </div>
          {/* プライマリアクションを右側に縦積み (sm+) */}
          <div className="hidden sm:flex flex-col gap-1.5 flex-shrink-0">
            <Button
              onClick={openShoppingList}
              className="gap-1.5 justify-start"
              size="sm"
            >
              <ShoppingCart className="w-4 h-4" />
              買い物
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 justify-start"
            >
              <a
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Video className="w-3.5 h-3.5 text-destructive" />
                YouTube
              </a>
            </Button>
            {recipe.source_url && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-1.5 justify-start"
              >
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  元レシピ
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* モバイル用プライマリアクション (横並び) */}
        <div className="flex sm:hidden flex-wrap items-center gap-2">
          <Button onClick={openShoppingList} className="gap-1.5" size="sm">
            <ShoppingCart className="w-4 h-4" />
            買い物
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <a
              href={youtubeSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Video className="w-3.5 h-3.5 text-destructive" />
              YouTube
            </a>
          </Button>
          {recipe.source_url && (
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                元レシピ
              </a>
            </Button>
          )}
        </div>

        {/* セカンダリアクション (編集・削除): 控えめに右下寄せ */}
        <div className="flex justify-end gap-1 -mt-2">
          <Button
            size="icon"
            variant="ghost"
            asChild
            aria-label="編集"
            title="編集"
            className="w-7 h-7 text-muted-foreground"
          >
            <Link href={`/recipes/${recipe.id}/edit`}>
              <Pencil className="w-3.5 h-3.5" />
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={deleteRecipe}
            aria-label="削除"
            title="削除"
            className="w-7 h-7 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Separator />

        {/* ===== 作り方 (シンプルな縦リスト, 完了状態なし) ===== */}
        {stepsState.length > 0 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg md:text-xl font-bold">作り方</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stepsState.length}ステップ
              </p>
            </div>

            {stepPhases.map((phase, phaseIndex) => (
              <section key={phaseIndex} className="space-y-4">
                {phase.name && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {phaseIndex + 1} / {stepPhases.length}
                      </span>
                      <h3 className="text-base font-semibold">{phase.name}</h3>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <ol className="space-y-5">
                  {phase.steps.map((step) => {
                    const absIndex = stepsState.findIndex(
                      (s) => s.order === step.order,
                    );
                    const stepIngredients = findStepIngredients(
                      step.text,
                      ingredientsList,
                    );
                    return (
                      <li key={step.order} className="flex gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center mt-0.5 tabular-nums">
                          {step.order}
                        </span>
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-base leading-relaxed">
                            {step.text}
                          </p>
                          {(step.image_query ||
                            stepIngredients.length > 0) && (
                            <div className="flex flex-col sm:flex-row gap-3">
                              {step.image_query && (
                                <div className="sm:flex-1 min-w-0">
                                  <StepImage
                                    query={step.image_query}
                                    onRegenerate={() =>
                                      regenerateOneStepImage(absIndex)
                                    }
                                    regenerating={regeneratingStep === absIndex}
                                  />
                                </div>
                              )}
                              {stepIngredients.length > 0 && (
                                <div
                                  className={
                                    step.image_query
                                      ? "grid grid-cols-4 sm:grid-cols-2 gap-2 sm:w-32 sm:flex-shrink-0 content-start"
                                      : "grid grid-cols-4 sm:grid-cols-6 gap-2"
                                  }
                                >
                                  {stepIngredients
                                    .slice(0, 8)
                                    .map((ing, idx) => (
                                      <div
                                        key={`${ing.name}-${idx}`}
                                        className="flex flex-col items-center gap-0.5"
                                      >
                                        <IngredientThumb
                                          ingredient={ing}
                                          size="sm"
                                        />
                                        <span className="text-[10px] text-muted-foreground line-clamp-1 text-center w-full">
                                          {ing.name}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
