"use client";

import { useState } from "react";
import { RefreshCw, Sparkles, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@takaki/go-design-system";
import { useFoodImage } from "@/hooks/use-food-image";
import type { RecipeIngredient } from "@/types/database";
import { cn } from "@/lib/utils";

type ThumbSize = "sm" | "md" | "lg" | "xl";

interface IngredientThumbProps {
  ingredient: RecipeIngredient;
  size?: ThumbSize;
  className?: string;
  /** true なら右上に画像再生成ボタンを重ねる */
  regenerable?: boolean;
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
 * 食材のサムネイル。Unsplash query にスーパー商品っぽい修飾を加える。
 * regenerable=true で右上に画像差し替えオーバーレイを表示。
 */
export function IngredientThumb({
  ingredient: ing,
  size = "md",
  className,
  regenerable = false,
}: IngredientThumbProps) {
  const baseName = ing.name_en ?? ing.name;
  // 単品商品 (single product) を狙う: 「grocery store product」サフィックスは
  // 棚陳列画像を引きやすいため使わず、bare name を /api/image に渡してバリエーション
  // 検索 (food / fresh ingredient) でフォールバックさせる
  const query = baseName || null;
  const [seed, setSeed] = useState(1);
  const { imageUrl, loading } = useFoodImage(query, seed);

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
            setSeed((s) => s + 1);
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
