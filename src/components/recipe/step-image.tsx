"use client";

import { RefreshCw, Sparkles, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@takaki/go-design-system";
import { useFoodImage } from "@/hooks/use-food-image";

interface StepImageProps {
  query: string | null;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export function StepImage({
  query,
  onRegenerate,
  regenerating,
}: StepImageProps) {
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
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/75 transition-colors disabled:opacity-50"
          aria-label="この画像を変える"
          title="画像を別の候補に変える"
        >
          {regenerating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
