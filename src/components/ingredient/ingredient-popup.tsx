"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  toast,
} from "@takaki/go-design-system";
import type { IngredientInfo, RecipeIngredient } from "@/types/database";
import { stripEmoji } from "@/lib/recipe-tags";

interface IngredientPopupProps {
  ingredient: RecipeIngredient | null;
  onOpenChange: (open: boolean) => void;
}

interface FetchResult {
  info: IngredientInfo | null;
}

async function fetchInfo(name: string): Promise<IngredientInfo | null> {
  const res = await fetch(`/api/ingredients?name=${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as FetchResult;
  return data.info;
}

async function generateInfo(
  ing: RecipeIngredient,
): Promise<IngredientInfo | null> {
  const res = await fetch(`/api/ingredients/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: ing.name,
      name_en: ing.name_en,
      name_vi: ing.name_vi,
      category: ing.category,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "生成に失敗しました");
  }
  const data = (await res.json()) as FetchResult;
  return data.info;
}

export function IngredientPopup({
  ingredient,
  onOpenChange,
}: IngredientPopupProps) {
  const open = ingredient !== null;
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [info, setInfo] = useState<IngredientInfo | null>(null);

  useEffect(() => {
    if (!ingredient) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setInfo(null);
    fetchInfo(ingredient.name)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ingredient]);

  const handleGenerate = async () => {
    if (!ingredient) return;
    setGenerating(true);
    try {
      const generated = await generateInfo(ingredient);
      setInfo(generated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {ingredient && (
          <>
            <DialogHeader>
              <DialogTitle>{ingredient.name}</DialogTitle>
              {(ingredient.name_en || ingredient.name_vi) && (
                <DialogDescription>
                  {[ingredient.name_en, ingredient.name_vi]
                    .filter(Boolean)
                    .join(" / ")}
                </DialogDescription>
              )}
            </DialogHeader>

            {loading ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">読み込み中…</p>
              </div>
            ) : info ? (
              <div className="space-y-5">
                {info.origin && (
                  <Section title="名前の由来">
                    <p className="text-sm leading-relaxed">{info.origin}</p>
                  </Section>
                )}
                {info.composition && (
                  <Section title="何でできているか">
                    <p className="text-sm leading-relaxed">
                      {info.composition}
                    </p>
                  </Section>
                )}
                {info.taste_profile && (
                  <Section title="味の特徴">
                    <p className="text-sm leading-relaxed">
                      {info.taste_profile}
                    </p>
                  </Section>
                )}
                {info.pairings && info.pairings.length > 0 && (
                  <Section title="相性のいい食材">
                    <ul className="space-y-1.5 text-sm leading-relaxed">
                      {info.pairings.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-medium flex-shrink-0">
                            {p.food}
                          </span>
                          <span className="text-muted-foreground">
                            — {p.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {info.alternatives && info.alternatives.length > 0 && (
                  <Section title="代替品 (ホーチミンで手に入りやすい順)">
                    <ol className="space-y-1.5 text-sm leading-relaxed list-decimal list-inside">
                      {info.alternatives.map((a, i) => (
                        <li key={i}>
                          <span className="font-medium">{a.name}</span>
                          {a.reason && (
                            <span className="text-muted-foreground">
                              {" "}
                              — {a.reason}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </Section>
                )}
                {info.nutrition_tags && info.nutrition_tags.length > 0 && (
                  <Section title="栄養">
                    <div className="flex flex-wrap gap-1.5">
                      {info.nutrition_tags.map((t, i) => {
                        const label = stripEmoji(t);
                        if (!label) return null;
                        return (
                          <Badge key={`${t}-${i}`} variant="secondary">
                            {label}
                          </Badge>
                        );
                      })}
                    </div>
                  </Section>
                )}
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  まだ詳細が登録されていません
                </p>
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="gap-1.5"
                >
                  {generating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generating ? "生成中…" : "AI で生成する"}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
