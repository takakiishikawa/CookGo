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
  Badge,
  Button,
  Card,
  CardContent,
  PageHeader,
  Progress,
  Skeleton,
  Stepper,
  toast,
} from "@takaki/go-design-system";
import { Recipe, RecipeStep } from "@/types/database";
import { cn } from "@/lib/utils";
import { useFoodImage } from "@/hooks/use-food-image";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/constants";
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
        className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/75 transition-colors disabled:opacity-50"
        aria-label="この画像を更新"
        title="画像を別の候補に変える"
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

  const stepPhases = useMemo(
    () => groupStepsIntoPhases(stepsState),
    [stepsState],
  );
  const hasPhases = stepPhases.length > 1 && stepPhases[0].name !== "";

  // 各フェーズ範囲(absolute index 範囲)
  const phaseRanges = useMemo(() => {
    const ranges: Array<{ start: number; end: number; size: number }> = [];
    let cursor = 0;
    stepPhases.forEach((p) => {
      ranges.push({
        start: cursor,
        end: cursor + p.steps.length - 1,
        size: p.steps.length,
      });
      cursor += p.steps.length;
    });
    return ranges;
  }, [stepPhases]);

  // 現在のフェーズ index = "全ステップ完了済の連続するフェーズ" の次
  const currentPhaseIndex = useMemo(() => {
    if (!hasPhases) return 0;
    for (let i = 0; i < phaseRanges.length; i++) {
      const range = phaseRanges[i];
      const phaseSteps = stepsState.slice(range.start, range.end + 1);
      const allDone = phaseSteps.every((s) => completedSteps.has(s.order));
      if (!allDone) return i;
    }
    return phaseRanges.length - 1;
  }, [phaseRanges, stepsState, completedSteps, hasPhases]);

  const overallProgress =
    stepsState.length > 0
      ? Math.round((completedSteps.size / stepsState.length) * 100)
      : 0;

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
      <AppHeader
        breadcrumbs={[
          { label: "レシピ", href: "/recipes" },
          { label: recipe.title },
        ]}
      />

      {/* Hero image */}
      <div className="relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={recipe.title}
            className="w-full h-56 md:h-72 object-cover"
            fetchPriority="high"
            loading="eager"
          />
        ) : (
          <div className="w-full h-56 md:h-72 bg-surface-subtle flex items-center justify-center">
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

      <div className="px-4 md:px-8 pt-5 pb-12 space-y-6 max-w-4xl">
        {/* タイトル + アクション */}
        <PageHeader
          title={recipe.title}
          description={recipe.description ?? undefined}
          actions={
            <div className="flex items-center gap-1">
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
                className="gap-1.5 ml-1"
              >
                <ShoppingCart className="w-4 h-4" />
                買い物リスト
              </Button>
            </div>
          }
        />

        {/* 元レシピ: コンパクトな chip */}
        {recipe.source_url && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                元レシピ
                {sourceHostname && (
                  <Badge variant="secondary" className="ml-1 font-normal">
                    {sourceHostname}
                  </Badge>
                )}
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Video className="w-3.5 h-3.5 text-destructive" />
                YouTube で参考動画
              </a>
            </Button>
          </div>
        )}

        {/* 作り方 (メイン) */}
        {stepsState.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg md:text-xl font-bold">作り方</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {completedSteps.size} / {stepsState.length} ステップ完了
                </p>
              </div>
              {!recipe.source_url && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-1.5"
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
              )}
            </div>

            {/* 全体進捗バー */}
            <Progress value={overallProgress} />

            {/* フェーズ Stepper (6+ ステップのみ) */}
            {hasPhases && (
              <div className="rounded-lg border bg-card px-4 py-3">
                <Stepper
                  steps={stepPhases.map((p, i) => ({
                    title: p.name,
                    description: `${p.steps.length}ステップ`,
                    status:
                      i < currentPhaseIndex
                        ? ("completed" as const)
                        : i === currentPhaseIndex
                          ? ("current" as const)
                          : ("upcoming" as const),
                  }))}
                  currentStep={currentPhaseIndex}
                  orientation="horizontal"
                />
              </div>
            )}

            {/* ステップカード */}
            <div className="space-y-6">
              {stepPhases.map((phase, phaseIndex) => (
                <div key={phaseIndex} className="space-y-3">
                  {phase.name && (
                    <div className="flex items-center gap-2 px-1">
                      <Badge
                        variant={
                          phaseIndex === currentPhaseIndex
                            ? "default"
                            : "outline"
                        }
                      >
                        Phase {phaseIndex + 1}/{stepPhases.length}
                      </Badge>
                      <h3 className="text-base font-semibold">{phase.name}</h3>
                    </div>
                  )}
                  <div className="space-y-3">
                    {phase.steps.map((step) => {
                      const done = completedSteps.has(step.order);
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
                              ? "bg-primary/5 border-primary/30"
                              : "bg-card border-border hover:bg-muted",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold",
                                done
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-primary/10 text-primary",
                              )}
                            >
                              {done ? <Check className="w-4 h-4" /> : step.order}
                            </div>
                            <p
                              className={cn(
                                "text-base leading-relaxed flex-1 text-left pt-1.5",
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

            {/* 完了 mini-CTA */}
            {completedSteps.size === stepsState.length &&
              stepsState.length > 0 && (
                <Card className="bg-primary/5 border-primary/30">
                  <CardContent className="p-4 text-center space-y-2">
                    <p className="text-base font-semibold">完成です 🎉</p>
                    <p className="text-xs text-muted-foreground">
                      お疲れ様でした。次のレシピも探してみましょう。
                    </p>
                  </CardContent>
                </Card>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
