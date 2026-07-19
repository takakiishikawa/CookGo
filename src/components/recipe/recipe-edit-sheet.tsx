"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  toast,
} from "@takaki/go-design-system";
import {
  MAIN_INGREDIENT_TAGS,
  type MainIngredientTag,
  type Recipe,
} from "@/types/database";
import { MAIN_INGREDIENT_TAG_ICON } from "@/lib/recipe-tags";

interface RecipeEditSheetProps {
  recipe: Recipe | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (recipeId: string) => void;
}

export function RecipeEditSheet({
  recipe,
  onOpenChange,
  onDeleted,
}: RecipeEditSheetProps) {
  const router = useRouter();
  const [mainTag, setMainTag] = useState<MainIngredientTag | null>(null);
  const [savingTag, setSavingTag] = useState(false);

  useEffect(() => {
    setMainTag(recipe?.main_ingredient_tag ?? null);
    setSavingTag(false);
  }, [recipe?.id, recipe?.main_ingredient_tag]);

  const updateMainTag = async (tag: MainIngredientTag) => {
    if (!recipe || savingTag) return;
    const prev = mainTag;
    setMainTag(tag);
    setSavingTag(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ main_ingredient_tag: tag }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`「${tag}」に変更しました`);
      router.refresh();
    } catch (err) {
      setMainTag(prev);
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSavingTag(false);
    }
  };

  const deleteRecipe = async () => {
    if (!recipe) return;
    if (!confirm(`「${recipe.title}」を削除しますか?`)) return;
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("削除しました");
      onOpenChange(false);
      onDeleted?.(recipe.id);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  return (
    <Sheet open={recipe !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
        {recipe && (
          <div className="px-4 pb-6 space-y-4">
            <SheetHeader className="px-0">
              <SheetTitle className="font-serif text-lg truncate">
                {recipe.title}
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                主食材タグ
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MAIN_INGREDIENT_TAGS.map((tag) => {
                  const Icon = MAIN_INGREDIENT_TAG_ICON[tag];
                  const active = tag === mainTag;
                  return (
                    <Button
                      key={tag}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      disabled={savingTag}
                      onClick={() => updateMainTag(tag)}
                      className="h-8 gap-1"
                    >
                      <Icon className="w-3 h-3" />
                      {tag}
                      {active && <Check className="w-3 h-3" />}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={deleteRecipe}
                className="gap-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                削除
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
