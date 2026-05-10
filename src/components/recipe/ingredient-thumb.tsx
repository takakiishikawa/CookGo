"use client";

import { RefreshCw, Sparkles, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@takaki/go-design-system";
import { useFoodImage } from "@/hooks/use-food-image";
import { useImageSeed } from "@/hooks/use-image-seed";
import type { RecipeIngredient } from "@/types/database";
import { cn } from "@/lib/utils";

type ThumbSize = "sm" | "md" | "lg" | "xl";

interface IngredientThumbProps {
  ingredient: RecipeIngredient;
  size?: ThumbSize;
  className?: string;
  /** true なら右上に画像再生成ボタンを重ねる */
  regenerable?: boolean;
  /** 検索文脈。"supermarket" にするとパッケージ商品寄りの画像を優先 */
  queryContext?: "supermarket";
}

const SIZE_CLASS: Record<ThumbSize, string> = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-20 h-20",
  xl: "w-24 h-24",
};

const ICON_SIZE_CLASS: Record<ThumbSize, string> = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-7 h-7",
};

const REGEN_BUTTON_SIZE: Record<ThumbSize, string> = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-6 h-6",
  xl: "w-7 h-7",
};

const REGEN_ICON_SIZE: Record<ThumbSize, string> = {
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-3 h-3",
  xl: "w-3.5 h-3.5",
};

/**
 * 食材のサムネイル。
 * - 日本語名を主クエリ、英訳を queryAlt に渡し、両言語で画像を探す
 * - regenerable=true で sparkle ボタンを重ね、押下毎に seed を 1 つ進める
 *   選んだ seed は localStorage に保持されリロード後も維持される
 */
export function IngredientThumb({
  ingredient: ing,
  size = "md",
  className,
  regenerable = false,
  queryContext,
}: IngredientThumbProps) {
  const query = ing.name || null;
  const queryAlt =
    ing.name_en && ing.name_en !== ing.name ? ing.name_en : null;
  const seedKey = ing.name ? `ingredient:${ing.name}` : null;
  const [seed, regenerate] = useImageSeed(seedKey);
  const { imageUrl, loading } = useFoodImage(query, seed, {
    context: queryContext,
    category: ing.category ?? null,
    queryAlt,
  });

  const sizeClass = SIZE_CLASS[size];
  const iconClass = ICON_SIZE_CLASS[size];
  const regenButtonClass = REGEN_BUTTON_SIZE[size];
  const regenIconClass = REGEN_ICON_SIZE[size];

  const showRegenerate = regenerable && !!query;

  if (loading) {
    return (
      <Skeleton
        className={cn(sizeClass, "rounded-md flex-shrink-0", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "relative rounded-md flex-shrink-0 overflow-hidden",
        !imageUrl && "bg-surface-subtle flex items-center justify-center",
        className,
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={ing.name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <UtensilsCrossed
          className={cn(iconClass, "text-muted-foreground")}
          strokeWidth={1.5}
        />
      )}
      {showRegenerate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            regenerate();
          }}
          className={cn(
            "absolute top-0.5 right-0.5 inline-flex items-center justify-center rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/75 transition-colors",
            regenButtonClass,
          )}
          aria-label="画像を変える"
          title="画像を変える"
        >
          <Sparkles className={regenIconClass} />
        </button>
      )}
      {loading && regenerable && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <RefreshCw className="w-4 h-4 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
