"use client";

import { cn } from "@/lib/utils";

export type HomeMode = "discover" | "kitchen";

interface SegmentedToggleProps {
  mode: HomeMode;
  onChange: (mode: HomeMode) => void;
  className?: string;
}

export function SegmentedToggle({
  mode,
  onChange,
  className,
}: SegmentedToggleProps) {
  return (
    <div
      className={cn(
        "flex bg-[oklch(92%_0.012_70)] rounded-xl p-1",
        className,
      )}
    >
      {(
        [
          { id: "discover", label: "Discover" },
          { id: "kitchen", label: "Your Kitchen" },
        ] as const
      ).map((seg) => {
        const active = mode === seg.id;
        return (
          <button
            key={seg.id}
            type="button"
            onClick={() => onChange(seg.id)}
            aria-pressed={active}
            className={cn(
              "flex-1 md:flex-none text-center px-3 md:px-5 py-2 rounded-lg font-semibold text-[12.5px] md:text-[13px] transition-colors",
              active
                ? "bg-white text-[oklch(24%_0.02_50)]"
                : "text-[oklch(50%_0.02_50)] hover:text-[oklch(24%_0.02_50)]",
            )}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
