"use client";

import { ShoppingBasket, Sparkles } from "lucide-react";
import { Skeleton } from "@takaki/go-design-system";
import { useFoodImage } from "@/hooks/use-food-image";
import { useImageSeed } from "@/hooks/use-image-seed";
import { cn } from "@/lib/utils";

interface StapleThumbProps {
  /** 識別子。localStorage で seed を保持するためのキー(例: staple id) */
  storageKey?: string;
  name: string;
  nameEn: string | null;
  className?: string;
  /** true で右下に画像差し替えボタンを重ねる */
  regenerable?: boolean;
}

export function StapleThumb({
  storageKey,
  name,
  nameEn,
  className,
  regenerable = false,
}: StapleThumbProps) {
  // 日本語名を主クエリにし英訳を alt に渡すことで日英両方で検索する
  const query = name || null;
  const queryAlt = nameEn && nameEn !== name ? nameEn : null;
  const seedKey = storageKey ? `staple:${storageKey}` : null;
  const [seed, regenerate] = useImageSeed(seedKey);
  const { imageUrl, loading } = useFoodImage(query, seed, {
    context: "supermarket",
    queryAlt,
  });

  if (loading) {
    return <Skeleton className={cn("w-full h-full rounded-xl", className)} />;
  }

  return (
    <div className={cn("relative w-full h-full", className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover rounded-xl"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="w-full h-full rounded-xl bg-muted flex items-center justify-center">
          <ShoppingBasket
            className="w-8 h-8 text-muted-foreground/40"
            strokeWidth={1.5}
          />
        </div>
      )}
      {regenerable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            regenerate();
          }}
          aria-label={`${name} の画像を変える`}
          title="画像を変える"
          className="absolute bottom-1 left-1 inline-flex w-6 h-6 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 backdrop-blur transition-colors"
        >
          <Sparkles className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
