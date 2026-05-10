"use client";

import { useRouter } from "next/navigation";
import {
  ChevronRight,
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
import { cn } from "@/lib/utils";

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
  const hasAnyTag =
    !!countryName ||
    !!recipe.main_ingredient_tag ||
    (recipe.nutrition_tags && recipe.nutrition_tags.length > 0);

  const openShoppingList = () => {
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

          {hasAnyTag && (
            <div className="flex flex-wrap gap-1.5">
              {countryName && (
                <Badge variant="outline" className="gap-1">
                  {countryFlag && <span aria-hidden>{countryFlag}</span>}
                  {countryName}
                </Badge>
              )}
              {recipe.main_ingredient_tag && MainIcon && (
                <Badge variant="outline" className="gap-1">
                  <MainIcon className="w-3 h-3" />
                  {recipe.main_ingredient_tag}
                </Badge>
              )}
              {recipe.nutrition_tags?.map((t, i) => {
                const label = stripEmoji(t);
                if (!label) return null;
                return (
                  <Badge key={`${t}-${i}`} variant="outline">
                    {label}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* メインアクション 3 つ(カード行) */}
          <div className="space-y-2 pt-1">
            <ActionRow
              icon={ShoppingCart}
              label="買い物"
              onClick={openShoppingList}
            />
            <ActionRow
              icon={Video}
              label="YouTube"
              href={youtubeSearchUrl}
              external
            />
            <ActionRow
              icon={ExternalLink}
              label="元レシピ"
              href={recipe.source_url ?? undefined}
              external
              disabled={!recipe.source_url}
            />
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

interface ActionRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  disabled?: boolean;
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  href,
  external,
  disabled,
}: ActionRowProps) {
  const baseClass = cn(
    "flex items-center gap-3 w-full px-4 py-3 rounded-lg border bg-card text-left transition-colors",
    disabled
      ? "opacity-50 pointer-events-none"
      : "hover:bg-muted hover:border-foreground/20 cursor-pointer",
  );
  const content = (
    <>
      <Icon className="w-5 h-5 text-foreground/80 flex-shrink-0" />
      <span className="flex-1 font-medium text-sm">{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </>
  );
  if (href && !disabled) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={baseClass}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={baseClass}
    >
      {content}
    </button>
  );
}
