"use client";

import type { DiscoverTabId } from "@/types/database";
import { cn } from "@/lib/utils";

const TAB_DEFS: { id: DiscoverTabId; label: string }[] = [
  { id: "for_you", label: "For You" },
  { id: "quick", label: "Quick" },
  { id: "new_flavors", label: "New Flavors" },
  { id: "seasonal", label: "Seasonal" },
];

interface DiscoverTabsProps {
  active: DiscoverTabId;
  onChange: (tab: DiscoverTabId) => void;
}

export function DiscoverTabs({ active, onChange }: DiscoverTabsProps) {
  return (
    <div>
      <div className="flex gap-4 md:gap-6.5 mb-1.5 md:mb-2 overflow-x-auto">
        {TAB_DEFS.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={cn(
                "font-semibold text-[12.5px] md:text-sm pb-1.5 md:pb-2 border-b-2 shrink-0 transition-colors",
                isActive
                  ? "text-[oklch(24%_0.02_50)] border-[oklch(56%_0.15_35)]"
                  : "text-[oklch(55%_0.02_50)] border-transparent",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] md:text-[11.5px] text-[oklch(52%_0.02_50)] mb-3 md:mb-4">
        30% new each week, shuffled every visit
      </p>
    </div>
  );
}
