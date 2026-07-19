"use client";

import { Plus } from "lucide-react";
import { ChefHatIcon } from "@/components/brand/chef-hat-icon";
import {
  SegmentedToggle,
  type HomeMode,
} from "@/components/home/segmented-toggle";
import { AppSwitcherMenu } from "@/components/layout/app-switcher-menu";
import { UserMenuButton } from "@/components/layout/user-menu-button";

interface HomeHeaderProps {
  mode: HomeMode;
  onModeChange: (mode: HomeMode) => void;
  onAddRecipe: () => void;
}

export function HomeHeader({
  mode,
  onModeChange,
  onAddRecipe,
}: HomeHeaderProps) {
  return (
    <div className="px-4 md:px-8 pt-5 md:pt-6">
      <div className="flex items-center justify-between gap-3 mb-4 md:mb-5">
        <div className="flex items-center gap-2 min-w-0">
          <ChefHatIcon
            size={22}
            className="text-[oklch(56%_0.15_35)] shrink-0"
          />
          <span className="font-serif font-bold text-xl md:text-2xl text-[oklch(24%_0.02_50)] truncate">
            HomeCook
          </span>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <SegmentedToggle mode={mode} onChange={onModeChange} />
          <AppSwitcherMenu />
          <UserMenuButton />
          <button
            type="button"
            onClick={onAddRecipe}
            className="font-semibold text-[13px] text-white bg-[oklch(56%_0.15_35)] hover:bg-[oklch(49%_0.14_35)] transition-colors px-4.5 py-2.5 rounded-full cursor-pointer"
          >
            + Add recipe
          </button>
        </div>

        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <AppSwitcherMenu />
          <UserMenuButton />
          <button
            type="button"
            onClick={onAddRecipe}
            aria-label="レシピを追加"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[oklch(56%_0.15_35)] text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <SegmentedToggle mode={mode} onChange={onModeChange} className="md:hidden mb-4" />
    </div>
  );
}
