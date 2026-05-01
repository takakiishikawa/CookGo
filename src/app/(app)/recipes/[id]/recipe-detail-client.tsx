"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ExternalLink,
  Pencil,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Video,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import {
  Button,
  Card,
  CardContent,
  PageHeader,
  Section,
  Skeleton,
  toast,
} from "@takaki/go-design-system";
import { Recipe, RecipeIngredient, RecipeStep } from "@/types/database";
import { cn } from "@/lib/utils";
import { useFoodImage } from "@/hooks/use-food-image";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/constants";
import { groupIngredients } from "@/lib/ingredient-categories";
import { groupStepsIntoPhases } from "@/lib/step-phases";

interface RecipeDetailClientProps {
  recipe: Recipe;
}

const MAX_THUMBNAIL_SIZE_MB = 5;

function StepImage({
  query,
  onRegenerate,
  regenerating,
}: {
  query: string | null;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const { imageUrl, loading } = useFoodImage(query);
  return (
    <div className="relative">
      {loading ? (
        <Skeleton className="w-full aspect-video rounded-md" />
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={query ?? ""}
          className="w-full aspect-video object-cover rounded-md"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="w-full aspect-video rounded-md bg-surface-subtle flex items-center justify-center">
          <UtensilsCrossed className="w-6 h-6 text-muted-foreground/40" />
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRegenerate();
        }}
        disabled={regenerating}
        className="absolute top-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/75 transition-colors disabled:opacity-50"
        aria-label="この画像を更新"
        title="この画像を更新"
      >
        {regenerating ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function IngredientThumb({ ing }: { ing: RecipeIngredient }) {
  // スーパーで売られている商品っぽい雰囲気を出すため query にコンテキスト付与
  const baseName = ing.name_en ?? ing.name;
  const query = `${baseName} grocery store product`;
  const { imageUrl, loading } = useFoodImage(query);
  if (loading)
    return <Skeleton className="w-12 h-12 rounded-md flex-shrink-0" />;
  if (!imageUrl) {
    return (
      <div className="w-12 h-12 rounded-md bg-surface-subtle flex items-center justify-center flex-shrink-0">
        <UtensilsCrossed
          className="w-4 h-4 text-muted-foreground"
          strokeWidth={1.5}
        />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={ing.name}
      className="w-12 h-12 rounded-md object-cover flex-shrink-0"
      loading="lazy"
      decoding="async"
    />
  );
}

export function RecipeDetailClient({ recipe }: RecipeDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [imageUrl, setImageUrl] = useState<string | null>(recipe.image_url);
  const [uploading, setUploading] = useState(false);
  const [stepsState, setStepsState] = useState<RecipeStep[]>(() =>
    [...((recipe.steps as RecipeStep[]) ?? [])].sort(
      (a, b) => a.order - b.order,
    ),
  );
  const [regeneratingStep, setRegeneratingStep] = useState<number | null>(null);

  const ingredients = (recipe.ingredients as RecipeIngredient[]) ?? [];
  const ingredientGroups = useMemo(
    () => groupIngredients(ingredients),
    [ingredients],
  );

  const stepPhases = useMemo(
    () => groupStepsIntoPhases(stepsState),
    [stepsState],
  );

  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.title + " 作り方")}`;

  const sourceHostname = useMemo(() => {
    if (!recipe.source_url) return null;
    try {
      return new URL(recipe.source_url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }, [recipe.source_url]);

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

  const toggleStep = (order: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(order)) next.delete(order);
      else next.add(order);
      return next;
    });
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
      toast.success("写真を更新しました");
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
      <AppHeader backHref="/recipes" />

      {/* Hero image with upload */}
      <div className="relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={recipe.title}
            className="w-full h-56 object-cover"
            fetchPriority="high"
            loading="eager"
          />
        ) : (
          <div className="w-full h-56 bg-surface-subtle flex items-center justify-center">
            <UtensilsCrossed
              className="w-12 h-12 text-muted-foreground"
              strokeWidth={1.5}
            />
          </div>
        )}
        <div className="absolute bottom-2 right-2">
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
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5 bg-black/60 text-white hover:bg-black/80 backdrop-blur"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="w-3.5 h-3.5" />
            {uploading ? "アップロード中..." : "写真を変更"}
          </Button>
        </div>
      </div>

      <div className="px-4 md:px-8 pt-5 pb-8 space-y-6 max-w-4xl">
        {/* タイトル + 主要アクション */}
        <PageHeader
          title={recipe.title}
          description={recipe.description ?? undefined}
          actions={
            <div className="flex items-center gap-1.5">
              <Button
                size="icon"
                variant="ghost"
                asChild
                aria-label="編集"
                title="編集"
              >
                <Link href={`/recipes/${recipe.id}/edit`}>
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={deleteRecipe}
                aria-label="削除"
                title="削除"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
              <Button
                size="sm"
                onClick={openShoppingList}
                className="gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                買い物リスト
              </Button>
            </div>
          }
        />

        {/* 元レシピリンク (ハイライト) */}
        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">
                  元レシピを開く
                </p>
                {sourceHostname && (
                  <p className="text-xs text-muted-foreground truncate">
                    {sourceHostname}
                  </p>
                )}
              </div>
            </div>
            <span className="text-xs text-primary group-hover:underline shrink-0">
              別タブで開く →
            </span>
          </a>
        )}

        {/* 食材 (グループ別) */}
        <Section title="食材">
          {ingredientGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">食材情報なし</p>
          ) : (
            <div className="space-y-5">
              {ingredientGroups.map((group) => (
                <div key={group.group} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {group.items.length}品
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {group.items.map(({ index, ingredient: ing }) => {
                      const amountText = ing.unit
                        ? `${ing.amount}${ing.unit}`
                        : ing.amount;
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-3 px-3 py-2 rounded-md border bg-card border-border"
                        >
                          <IngredientThumb ing={ing} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {ing.name}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm">{amountText}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 作り方 */}
        {stepsState.length > 0 && (
          <Section
            title="作り方"
            description={`${completedSteps.size} / ${stepsState.length} ステップ完了`}
            actions={
              <a
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Video className="w-4 h-4 text-destructive" />
                YouTubeで参考動画を探す
              </a>
            }
          >
            <div className="space-y-6">
              {stepPhases.map((phase, phaseIndex) => (
                <div key={phaseIndex} className="space-y-3">
                  {phase.name && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Phase {phaseIndex + 1}
                      </span>
                      <h3 className="text-sm font-semibold">{phase.name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {phase.steps.length}ステップ
                      </span>
                    </div>
                  )}
                  <div className="space-y-3">
                    {phase.steps.map((step) => {
                      const done = completedSteps.has(step.order);
                      // step の絶対 index を取り戻す(0-based)
                      const absIndex = stepsState.findIndex(
                        (s) => s.order === step.order,
                      );
                      return (
                        <button
                          key={step.order}
                          onClick={() => toggleStep(step.order)}
                          className={cn(
                            "w-full text-left flex flex-col gap-3 p-4 rounded-lg border transition-colors",
                            done
                              ? "bg-primary/5 border-primary/20"
                              : "bg-card border-border hover:bg-muted",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold",
                                done
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-primary/10 text-primary",
                              )}
                            >
                              {done ? <Check className="w-4 h-4" /> : step.order}
                            </div>
                            <p
                              className={cn(
                                "text-base leading-relaxed flex-1 text-left pt-1",
                                done && "line-through text-muted-foreground",
                              )}
                            >
                              {step.text}
                            </p>
                          </div>
                          {step.image_query && (
                            <StepImage
                              query={step.image_query}
                              onRegenerate={() =>
                                regenerateOneStepImage(absIndex)
                              }
                              regenerating={regeneratingStep === absIndex}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
