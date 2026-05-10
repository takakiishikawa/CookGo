"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  FlaskConical,
  HeartHandshake,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import {
  Badge,
  Dialog,
  DialogContent,
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
  const [errored, setErrored] = useState(false);
  const [info, setInfo] = useState<IngredientInfo | null>(null);

  useEffect(() => {
    if (!ingredient) {
      setInfo(null);
      setLoading(false);
      setGenerating(false);
      setErrored(false);
      return;
    }
    let cancelled = false;
    setInfo(null);
    setErrored(false);
    setLoading(true);
    setGenerating(false);

    (async () => {
      try {
        const cached = await fetchInfo(ingredient.name);
        if (cancelled) return;
        if (cached) {
          setInfo(cached);
          return;
        }
        setLoading(false);
        setGenerating(true);
        const generated = await generateInfo(ingredient);
        if (cancelled) return;
        if (generated) setInfo(generated);
        else setErrored(true);
      } catch (err) {
        if (cancelled) return;
        setErrored(true);
        toast.error(err instanceof Error ? err.message : "生成に失敗しました");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setGenerating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ingredient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        {ingredient && (
          <>
            <div className="space-y-2 pr-6">
              <DialogTitle className="text-2xl font-bold leading-tight">
                {ingredient.name}
              </DialogTitle>
              {info?.nutrition_tags && info.nutrition_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {info.nutrition_tags.map((t, i) => {
                    const label = stripEmoji(t);
                    if (!label) return null;
                    return (
                      <Badge key={`${t}-${i}`} variant="outline">
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {(loading || generating) && !info ? (
              <LoadingState name={ingredient.name} generating={generating} />
            ) : info ? (
              <div className="mt-4 space-y-5">
                {info.origin && (
                  <Section icon={BookOpen} title="名前の由来">
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {info.origin}
                    </p>
                  </Section>
                )}
                {info.composition && (
                  <Section icon={FlaskConical} title="何でできているか">
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {info.composition}
                    </p>
                  </Section>
                )}
                {info.taste_profile && (
                  <Section icon={UtensilsCrossed} title="味の特徴">
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {info.taste_profile}
                    </p>
                  </Section>
                )}
                {info.pairings && info.pairings.length > 0 && (
                  <Section icon={HeartHandshake} title="相性のいい食材">
                    <ul className="space-y-2 text-sm leading-relaxed">
                      {info.pairings.map((p, i) => (
                        <li
                          key={i}
                          className="flex flex-wrap items-baseline gap-x-2"
                        >
                          <span className="font-semibold text-foreground">
                            {p.food}
                          </span>
                          {p.reason && (
                            <span className="text-muted-foreground">
                              {p.reason}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {info.alternatives && info.alternatives.length > 0 && (
                  <Section
                    icon={ArrowLeftRight}
                    title="代替品"
                    hint="ホーチミンで手に入りやすい順"
                  >
                    <ol className="space-y-2 text-sm leading-relaxed">
                      {info.alternatives.map((a, i) => (
                        <li
                          key={i}
                          className="flex flex-wrap items-baseline gap-x-2"
                        >
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-semibold text-foreground">
                            {a.name}
                          </span>
                          {a.reason && (
                            <span className="text-muted-foreground">
                              {a.reason}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </Section>
                )}
              </div>
            ) : errored ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                この食材の詳細はまだ生成できませんでした。あとで再度開いてみてください。
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoadingState({
  name,
  generating,
}: {
  name: string;
  generating: boolean;
}) {
  return (
    <div className="mt-6 py-10 flex flex-col items-center gap-3 text-center">
      <Sparkles className="w-8 h-8 text-primary animate-pulse" />
      <div className="space-y-1">
        <p className="text-base font-semibold">「{name}」を調べています</p>
        {generating && (
          <>
            <p className="text-sm text-muted-foreground">
              AI が由来や味の秘密を集めています…
            </p>
            <p className="text-xs text-muted-foreground">
              初回のみ少し時間がかかります(次からは一瞬で開きます)
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
