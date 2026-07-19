"use client";

import Image from "next/image";
import { useIsMobile } from "@takaki/go-design-system";
import { dishTint } from "@/lib/dish-tint";

interface TileProps {
  label: string;
  imageUrl: string | null;
  tintIndex: number;
  heightIndex: number;
  onClick: () => void;
  children: React.ReactNode;
}

export function Tile({
  label,
  imageUrl,
  tintIndex,
  heightIndex,
  onClick,
  children,
}: TileProps) {
  const isMobile = useIsMobile();
  const heightPx = isMobile
    ? 130 + (heightIndex % 3) * 32
    : 175 + (heightIndex % 3) * 42;

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
