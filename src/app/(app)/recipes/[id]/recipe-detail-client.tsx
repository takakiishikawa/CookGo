"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Minus,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import {
  Badge,
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

interface RecipeDetailClientProps {
  recipe: Recipe;
}

const MAX_THUMBNAIL_SIZE_MB = 5;
const SCALABLE_UNITS = new Set([
  "g",
  "kg",
  "ml",
  "l",
  "個",
  "本",
  "枚",
  "片",
  "切れ",
  "尾",
  "玉",
  "房",
  "袋",
  "缶",
  "丁",
  "杯",
]);

function StepImage({ query }: { query: string | null }) {
  const { imageUrl, loading } = useFoodImage(query);
  if (loading) return <Skeleton className="w-full aspect-video rounded-md" />;
  if (!imageUrl) return null;
  return (
    <img
      src={imageUrl}
      alt={query ?? ""}
      className="w-full aspect-video object-cover rounded-md"
      loading="lazy"
      decoding="async"
    />
  );
}

function IngredientThumb({ ing }: { ing: RecipeIngredient }) {
  const { imageUrl, loading } = useFoodImage(ing.name_en ?? ing.name);
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

function formatAmount(amount: number): string {
  // 小数点1桁、末尾の0は削除
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function scaleAmount(
  ing: RecipeIngredient,
  ratio: number,
): { text: string; scaled: boolean } {
  const unit = (ing.unit ?? "").trim();
  const raw = (ing.amount ?? "").trim();
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0 && SCALABLE_UNITS.has(unit)) {
    return {
      text: `${formatAmount(numeric * ratio)}${unit}`,
      scaled: ratio !== 1,
    };
  }
  // それ以外(大さじ・小さじ・適量等)はそのまま
  return {
    text: unit ? `${raw}${unit}` : raw,
    scaled: false,
  };
}

export function RecipeDetailClient({ recipe }: RecipeDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [servings, setServings] = useState<number>(
    Math.max(1, recipe.servings || 1),
  );
  const [imageUrl, setImageUrl] = useState<string | null>(recipe.image_url);
  const [uploading, setUploading] = useState(false);
  const [regeneratingSteps, setRegeneratingSteps] = useState(false);
  const [stepsState, setStepsState] = useState<RecipeStep[]>(
    () =>
      [...((recipe.steps as RecipeStep[]) ?? [])].sort(
        (a, b) => a.order - b.order,
      ),
  );

  const baseServings = Math.max(1, recipe.servings || 1);
  const ratio = useMemo(() => servings / baseServings, [servings, baseServings]);

  const ingredients = (recipe.ingredients as RecipeIngredient[]) ?? [];
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.title + " 作り方")}`;

  const sourceHostname = useMemo(() => {
    if (!recipe.source_url) return null;
    try {
      return new URL(recipe.source_url).hostname;
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

  const duplicateRecipe = async () => {
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("複製しました");
      router.push(`/recipes/${data.recipe_id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "複製に失敗しました");
    }
  };

  const openShoppingList = () => {
    router.push(`/recipes/${recipe.id}/shopping?servings=${servings}`);
  };

  const regenerateStepImages = async () => {
    setRegeneratingSteps(true);
    try {
      const res = await fetch(
        `/api/recipes/${recipe.id}/regenerate-step-images`,
        { method: "POST" },
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const updated = (data.steps as RecipeStep[]) ?? [];
      setStepsState(updated.sort((a, b) => a.order - b.order));
      toast.success("ステップ画像を更新しました");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setRegeneratingSteps(false);
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
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext)
        ? ext
        : "jpg";
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
      toast.error(err instanceof Error ? err.message : "アップロードに失敗しました");
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
        <div className="flex flex-wrap items-center gap-2">
          {recipe.source_tag && (
            <Badge variant="outline">
              {recipe.source_tag === "self"
                ? "自作"
                : recipe.source_tag === "ai_suggest"
                  ? "AI提案"
                  : "宅配"}
            </Badge>
          )}
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              元レシピ
              {sourceHostname && (
                <span className="text-muted-foreground">({sourceHostname})</span>
              )}
            </a>
          )}
        </div>

        <PageHeader
          title={recipe.title}
          description={recipe.description ?? undefined}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <Link href={`/recipes/${recipe.id}/edit`}>
                  <Pencil className="w-3.5 h-3.5" />
                  編集
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={duplicateRecipe}
              >
                <Copy className="w-3.5 h-3.5" />
                複製
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={deleteRecipe}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                削除
              </Button>
            </div>
          }
        />

        {/* 人数調整 + 調理時間 */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">人数</p>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    aria-label="人数を減らす"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-sm font-semibold tabular-nums w-8 text-center">
                    {servings}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => setServings((s) => Math.min(20, s + 1))}
                    aria-label="人数を増やす"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          {recipe.prep_time_min && (
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">調理時間</p>
                  <p className="text-sm font-semibold">
                    {recipe.prep_time_min}分
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {baseServings !== servings && (
            <Card>
              <CardContent className="p-3 text-xs text-muted-foreground">
                元レシピ: {baseServings}人分
                <br />
                {ratio.toFixed(1)}倍に換算
              </CardContent>
            </Card>
          )}
        </div>

        {/* 食材 */}
        <Section title="食材" description={`${ingredients.length}品`}>
          {ingredients.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {ingredients.map((ing, i) => {
                  const { text: amountText, scaled } = scaleAmount(ing, ratio);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-md border bg-card border-border"
                    >
                      <IngredientThumb ing={ing} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {ing.name}
                        </p>
                        {(ing.name_en || ing.name_vi) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[ing.name_en, ing.name_vi]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className={cn(
                            "text-sm",
                            scaled && "text-primary font-semibold",
                          )}
                        >
                          {amountText}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                size="sm"
                onClick={openShoppingList}
                className="gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                買い物リストを開く
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">食材情報なし</p>
          )}
        </Section>

        {/* Steps */}
        {stepsState.length > 0 && (
          <Section
            title="作り方"
            description={`${completedSteps.size} / ${stepsState.length} ステップ完了`}
            actions={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={regenerateStepImages}
                  disabled={regeneratingSteps}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
                  title="レシピ全体からステップ画像クエリを再生成"
                >
                  {regeneratingSteps ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  画像を更新
                </button>
                <a
                  href={youtubeSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-destructive font-medium hover:underline"
                >
                  <Play className="w-4 h-4" />
                  動画で見る
                </a>
              </div>
            }
          >
            <div className="space-y-4">
              {stepsState.map((step) => {
                const done = completedSteps.has(step.order);
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
                    {step.image_query && <StepImage query={step.image_query} />}
                  </button>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
