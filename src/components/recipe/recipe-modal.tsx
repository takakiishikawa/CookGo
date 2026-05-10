"use client";

import { useRouter } from "next/navigation";
import {
  ExternalLink,
  ShoppingCart,
  Trash2,
  Video,
} from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  toast,
} from "@takaki/go-design-system";
import type { Recipe } from "@/types/database";
import {
  MAIN_INGREDIENT_TAG_ICON,
  extractCountryName,
  getCountryFlag,
  stripEmoji,
} from "@/lib/recipe-tags";

interface RecipeModalProps {
  recipe: Recipe | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (recipeId: string) => void;
}

export function RecipeModal({
  recipe,
  onOpenChange,
  onDeleted,
}: RecipeModalProps) {
  const router = useRouter();

  const open = recipe !== null;
  if (!recipe) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" />
      </Dialog>
    );
  }

  const countryName = extractCountryName(recipe.country_tag);
  const countryFlag = getCountryFlag(countryName);
  const MainIcon = recipe.main_ingredient_tag
    ? MAIN_INGREDIENT_TAG_ICON[recipe.main_ingredient_tag]
    : null;
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    recipe.title + " 作り方",
  )}`;

  const openShoppingList = () => {
    onOpenChange(false);
    router.push(`/recipes/${recipe.id}/shopping`);
  };

  const deleteRecipe = async () => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <div className="space-y-4">
          <DialogTitle className="text-xl md:text-2xl font-semibold leading-tight pr-6">
            {recipe.title}
          </DialogTitle>

          {recipe.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {recipe.description}
            </p>
          )}

          {(countryName || recipe.main_ingredient_tag) && (
            <div className="flex flex-wrap gap-1.5">
              {countryName && (
                <Badge variant="outline" className="gap-1">
                  {countryFlag ? (
                    <span aria-hidden>{countryFlag}</span>
                  ) : null}
                  {countryName}
                </Badge>
              )}
              {recipe.main_ingredient_tag && MainIcon && (
                <Badge variant="outline" className="gap-1">
                  <MainIcon className="w-3 h-3" />
                  {recipe.main_ingredient_tag}
                </Badge>
              )}
            </div>
          )}

          {recipe.nutrition_tags && recipe.nutrition_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.nutrition_tags.map((t, i) => {
                const label = stripEmoji(t);
                if (!label) return null;
                return (
                  <Badge key={`${t}-${i}`} variant="secondary">
                    {label}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* メインアクション 3 つ(同格) */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button variant="outline" onClick={openShoppingList} className="gap-1.5">
              <ShoppingCart className="w-4 h-4" />
              買い物
            </Button>
            <Button variant="outline" asChild className="gap-1.5">
              <a
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Video className="w-4 h-4" />
                YouTube
              </a>
            </Button>
            <Button
              variant="outline"
              asChild
              disabled={!recipe.source_url}
              className="gap-1.5"
            >
              {recipe.source_url ? (
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  元レシピ
                </a>
              ) : (
                <span>
                  <ExternalLink className="w-4 h-4" />
                  元レシピ
                </span>
              )}
            </Button>
          </div>

          {/* 削除: 誤タップ防止のため小さく右寄せ */}
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
      </DialogContent>
    </Dialog>
  );
}
