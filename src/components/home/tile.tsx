"use client";

import Image from "next/image";
import { useIsMobile } from "@takaki/go-design-system";
import { dishTint } from "@/lib/dish-tint";

interface TileProps {
  id: string;
  label: string;
  imageUrl: string | null;
  tintIndex: number;
  onClick: () => void;
  children: React.ReactNode;
}

const HEIGHT_BUCKETS = 5;

/**
 * Height bucket derived from a hash of the tile's own id, not its position
 * in the list. A positional `index % n` cycle can alias with the column
 * count (e.g. 12 items / 4 columns landing exactly on whole multiples of a
 * 3-cycle) and make every column end up with an identical height sequence,
 * which reads as a plain uniform grid instead of a staggered masonry.
 * Hashing the id avoids any such correlation with layout/ordering.
 */
function heightBucket(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % HEIGHT_BUCKETS;
}

export function Tile({
  id,
  label,
  imageUrl,
  tintIndex,
  onClick,
  children,
}: TileProps) {
  const isMobile = useIsMobile();
  const bucket = heightBucket(id);
  const heightPx = isMobile ? 120 + bucket * 24 : 160 + bucket * 32;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer break-inside-avoid mb-[9px] md:mb-3.5 relative rounded-[10px] md:rounded-[11px] overflow-hidden"
      style={{
        height: heightPx,
        background: imageUrl ? undefined : dishTint(tintIndex),
      }}
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={label}
          fill
          sizes="(min-width: 768px) 25vw, 50vw"
          className="object-cover"
        />
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(20,14,8,.6), transparent 55%)",
        }}
      />
      <div className="absolute left-[7px] md:left-2.5 bottom-1.5 md:bottom-2 right-[7px] md:right-2.5 font-serif font-semibold text-[11px] md:text-[12.5px] text-white line-clamp-2 pointer-events-none">
        {label}
      </div>
      {children}
    </div>
  );
}
