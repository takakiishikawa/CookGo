"use client";

import { useState } from "react";
import { HomeHeader } from "@/components/layout/home-header";
import type { HomeMode } from "@/components/home/segmented-toggle";
import { DiscoverSection } from "@/components/home/discover-section";
import { KitchenSection } from "@/components/home/kitchen-section";
import { AddRecipeCard } from "@/components/recipe/add-recipe-card";
import { RecipeEditSheet } from "@/components/recipe/recipe-edit-sheet";
import type {
  DiscoverItem,
  DiscoverTabId,
  MainIngredientTag,
  Recipe,
} from "@/types/database";

interface HomeClientProps {
  recipes: Recipe[];
  discoverItems: DiscoverItem[];
}

export function HomeClient({ recipes, discoverItems }: HomeClientProps) {
  const [mode, setMode] = useState<HomeMode>("discover");
  const [activeTab, setActiveTab] = useState<DiscoverTabId>("for_you");
  const [category, setCategory] = useState<MainIngredientTag | null>(null);
  const [expandedTileId, setExpandedTileId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  // stable per mount; re-randomizes on the next visit/reload, matching the
  // "shuffled every visit" behavior from the design spec
  const [visitSeed] = useState(() => Math.random());

  const toggleExpand = (id: string) => {
    setExpandedTileId((cur) => (cur === id ? null : id));
  };

  return (
    <div className="flex flex-col pb-16">
      <HomeHeader
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          setExpandedTileId(null);
        }}
        onAddRecipe={() => setAddOpen(true)}
      />

      <div className="px-4 md:px-8 pt-1">
        {mode === "discover" ? (
          <DiscoverSection
            discoverItems={discoverItems}
            recipes={recipes}
            activeTab={activeTab}
            onTabChange={(t) => {
              setActiveTab(t);
              setExpandedTileId(null);
            }}
            expandedTileId={expandedTileId}
            onToggleExpand={toggleExpand}
            visitSeed={visitSeed}
          />
        ) : (
          <KitchenSection
            recipes={recipes}
            category={category}
            onCategoryChange={(c) => {
              setCategory(c);
              setExpandedTileId(null);
            }}
            expandedTileId={expandedTileId}
            onToggleExpand={toggleExpand}
            onEdit={setEditingRecipe}
            onAddRecipe={() => setAddOpen(true)}
          />
        )}
      </div>

      <AddRecipeCard open={addOpen} onOpenChange={setAddOpen} />
      <RecipeEditSheet
        recipe={editingRecipe}
        onOpenChange={(o) => {
          if (!o) setEditingRecipe(null);
        }}
        onDeleted={() => setEditingRecipe(null)}
      />
    </div>
  );
}
