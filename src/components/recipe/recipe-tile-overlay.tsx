"use client";

import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

function ShoppingIcon({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="oklch(40% 0.06 35)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderTop: "5px solid transparent",
        borderBottom: "5px solid transparent",
        borderLeft: "7px solid #fff",
        marginLeft: 2,
      }}
      aria-hidden="true"
    />
  );
}

function RecipeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="oklch(38% 0.02 50)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function NavIcon({
  bg,
  label,
  href,
  onClick,
  disabled,
  children,
}: {
  bg: string;
  label: string;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      <div
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0"
        style={{ background: bg }}
      >
        {children}
      </div>
      <span className="font-semibold text-[8.5px] text-white">{label}</span>
    </>
  );

  const className = cn(
    "flex flex-col items-center gap-[3px]",
    disabled && "opacity-40 pointer-events-none",
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={className}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={className}
    >
      {inner}
    </button>
  );
}

interface RecipeTileOverlayProps {
  variant: "discover" | "kitchen";
  visible: boolean;
  onShoppingClick: (e: React.MouseEvent) => void;
  youtubeHref: string;
  sourceHref?: string;
  saved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent) => void;
}

export function RecipeTileOverlay({
  variant,
  visible,
  onShoppingClick,
  youtubeHref,
  sourceHref,
  saved,
  onToggleSave,
  onEdit,
}: RecipeTileOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 bg-[rgba(20,14,8,.6)] transition-opacity duration-150",
        visible
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none",
        "md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto",
      )}
    >
      {variant === "discover" && onToggleSave && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(e);
          }}
          aria-label={saved ? "保存を解除" : "保存"}
          className="absolute top-1.5 right-1.5 w-[26px] h-[26px] rounded-full bg-white/92 flex items-center justify-center text-sm"
          style={{ color: saved ? "#e0527a" : "oklch(45% 0.02 50)" }}
        >
          {saved ? "♥" : "♡"}
        </button>
      )}

      {variant === "kitchen" && onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(e);
          }}
          aria-label="編集"
          className="absolute top-1.5 right-1.5 w-[26px] h-[26px] rounded-full bg-white/92 flex items-center justify-center text-[oklch(45%_0.02_50)]"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-2.5">
        <NavIcon
          bg="oklch(93% 0.015 70)"
          label="Shopping"
          onClick={onShoppingClick}
        >
          <ShoppingIcon />
        </NavIcon>
        <NavIcon bg="#e02f2f" label="YouTube" href={youtubeHref}>
          <YoutubeIcon />
        </NavIcon>
        <NavIcon
          bg="oklch(93% 0.015 70)"
          label="Recipe"
          href={sourceHref}
          disabled={!sourceHref}
        >
          <RecipeIcon />
        </NavIcon>
      </div>
    </div>
  );
}
