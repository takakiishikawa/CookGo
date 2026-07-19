"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile, toast } from "@takaki/go-design-system";
import type { DiscoverItem, DiscoverTabId, Recipe } from "@/types/database";
import { seededShuffle } from "@/lib/seeded-shuffle";
import { youtubeSearchUrl } from "@/lib/recipe-links";
import { saveDiscoverItem } from "@/lib/save-discover-item";
import { fetchRecipe } from "@/lib/fetch-recipe";
import { DiscoverTabs } from "@/components/home/discover-tabs";
import { Tile } from "@/components/home/tile";
import { RecipeTileOverlay } from "@/components/recipe/recipe-tile-overlay";

interface DiscoverSectionProps {
  discoverItems: DiscoverItem[];
  recipes: Recipe[];
  activeTab: DiscoverTabId;
  onTabChange: (tab: DiscoverTabId) => void;
  expandedTileId: string | null;
  onToggleExpand: (id: string) => void;
  onOpenShopping: (recipe: Recipe) => void;
  visitSeed: number;
}

export function DiscoverSection({
  discoverItems,
  recipes,
  activeTab,
  onTabChange,
  expandedTileId,
  onToggleExpand,
  onOpenShopping,
  visitSeed,
}: DiscoverSectionProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [savingId, setSavingId] = useState<string | null>(null);

  const savedSourceUrls = useMemo(
    () => new Set(recipes.map((r) => r.source_url).filter(Boolean)),
    [recipes],
  );

  const tiles = useMemo(() => {
    const tabItems = discoverItems.filter((it) => it.tab_id === activeTab);
    const shuffled = seededShuffle(tabItems, activeTab, visitSeed);
    return shuffled.slice(0, isMobile ? 8 : 16);
  }, [discoverItems, activeTab, visitSeed, isMobile]);

  const handleSave = async (item: DiscoverItem) => {
    if (savingId) return;
    setSavingId(item.id);
    try {
      await saveDiscoverItem(item.source_url);
      toast.success(`「${item.title}」を Your Kitchen に保存しました`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSavingId(null);
    }
  };

  const handleShoppingClick = async (item: DiscoverItem) => {
    if (savingId) return;
    setSavingId(item.id);
    try {
      const { recipeId } = await saveDiscoverItem(item.source_url);
      const recipe = await fetchRecipe(recipeId);
      onOpenShopping(recipe);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <DiscoverTabs active={activeTab} onChange={onTabChange} />
      <div className="columns-2 md:columns-4 gap-[9px] md:gap-3.5">
        {tiles.map((item, i) => (
          <Tile
            key={item.id}
            id={item.id}
            label={item.title}
            imageUrl={item.image_url}
            tintIndex={i}
            onClick={() => onToggleExpand(item.id)}
          >
            <RecipeTileOverlay
              variant="discover"
              visible={expandedTileId === item.id}
              onShoppingClick={() => handleShoppingClick(item)}
              youtubeHref={youtubeSearchUrl(item.title)}
              sourceHref={item.source_url}
              saved={savedSourceUrls.has(item.source_url)}
              onToggleSave={() => handleSave(item)}
            />
          </Tile>
        ))}
      </div>
    </div>
  );
}
