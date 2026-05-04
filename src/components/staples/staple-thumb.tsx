"use client";

import { ShoppingBasket } from "lucide-react";
import { Skeleton } from "@takaki/go-design-system";
import { useFoodImage } from "@/hooks/use-food-image";
import { cn } from "@/lib/utils";

interface StapleThumbProps {
  name: string;
  nameEn: string | null;
  className?: string;
}

export function StapleThumb({ name, nameEn, className }: StapleThumbProps) {
  const query = nameEn || name || null;
  const { imageUrl, loading } = useFoodImage(query);

  if (loading) {
    return (
      <Skeleton className={cn("w-full h-full rounded-xl", className)} />
    );
  }

  if (!imageUrl) {
    return (
      <div
        className={cn(
          "w-full h-full rounded-xl bg-muted flex items-center justify-center",
          className,
        )}
      >
        <ShoppingBasket
          className="w-8 h-8 text-muted-foreground/40"
          strokeWidth={1.5}
        />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className={cn(
        "w-full h-full object-cover rounded-xl",
        className,
      )}
      loading="lazy"
      decoding="async"
    />
  );
}
