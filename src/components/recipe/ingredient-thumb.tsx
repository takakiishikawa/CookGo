"use client";

import { UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@takaki/go-design-system";
import { useFoodImage } from "@/hooks/use-food-image";
import type { RecipeIngredient } from "@/types/database";
import { cn } from "@/lib/utils";

interface IngredientThumbProps {
  ingredient: RecipeIngredient;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<IngredientThumbProps["size"]>, string> = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-20 h-20",
};

const ICON_SIZE_CLASS: Record<NonNullable<IngredientThumbProps["size"]>, string> =
  {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

/**
 * 食材のサムネイル。
 * Unsplash query にスーパー商品っぽい修飾を加える。
 */
export function IngredientThumb({
  ingredient: ing,
  size = "md",
  className,
}: IngredientThumbProps) {
  const baseName = ing.name_en ?? ing.name;
  // 「スーパーで売られている商品」っぽい結果を狙う query
  const query = baseName ? `${baseName} grocery store product` : null;
  const { imageUrl, loading } = useFoodImage(query);

  const sizeClass = SIZE_CLASS[size];
  const iconClass = ICON_SIZE_CLASS[size];

  if (loading) {
    return (
      <Skeleton className={cn(sizeClass, "rounded-md flex-shrink-0", className)} />
    );
  }
  if (!imageUrl) {
    return (
      <div
        className={cn(
          sizeClass,
          "rounded-md bg-surface-subtle flex items-center justify-center flex-shrink-0",
          className,
        )}
      >
        <UtensilsCrossed
          className={cn(iconClass, "text-muted-foreground")}
          strokeWidth={1.5}
        />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={ing.name}
      className={cn(
        sizeClass,
        "rounded-md object-cover flex-shrink-0",
        className,
      )}
      loading="lazy"
      decoding="async"
    />
  );
}
