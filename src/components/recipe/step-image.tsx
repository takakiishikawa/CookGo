"use client";

import { RefreshCw, Sparkles, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@takaki/go-design-system";
import { useFoodImage } from "@/hooks/use-food-image";

interface StepImageProps {
  /** Unsplash 検索用クエリ (英語推奨)。directUrl が無いときに使用 */
  query: string | null;
  /** 元 URL のページから抽出した直接画像 URL。設定されていれば最優先で表示 */
  directUrl?: string | null;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export function StepImage({
  query,
  directUrl,
  onRegenerate,
  regenerating,
}: StepImageProps) {
  const useDirect = !!directUrl?.trim();
  const { imageUrl: fetchedUrl, loading } = useFoodImage(
    useDirect ? null : query,
  );
  const imageUrl = useDirect ? directUrl! : fetchedUrl;

  return (
    <div className="relative">
      {!useDirect && loading ? (
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
      {onRegenerate && !useDirect && (
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
