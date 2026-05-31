"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  ExternalLink,
  Pencil,
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
import {
  MAIN_INGREDIENT_TAGS,
  type MainIngredientTag,
  type Recipe,
} from "@/types/database";
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

  const [mainTag, setMainTag] = useState<MainIngredientTag | null>(null);
  const [editingTag, setEditingTag] = useState(false);
  const [savingTag, setSavingTag] = useState(false);

  // モーダルに渡るレシピが変わったらローカル状態を同期
  useEffect(() => {
    setMainTag(recipe?.main_ingredient_tag ?? null);
    setEditingTag(false);
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
      setEditingTag(false);
      toast.success(`「${tag}」に変更しました`);
      router.refresh();
    } catch (err) {
      setMainTag(prev);
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSavingTag(false);
    }
  };

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
  const MainIcon = mainTag ? MAIN_INGREDIENT_TAG_ICON[mainTag] : null;
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    recipe.title + " 作り方",
  )}`;

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

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {countryName && (
                <Badge variant="outline" className="gap-1">
                  {countryFlag && <span aria-hidden>{countryFlag}</span>}
                  {countryName}
                </Badge>
              )}
              {/* 主食材タグ: タップで編集できる。AI 分類が誤っても手で直せる */}
              <button
                type="button"
                onClick={() => setEditingTag((v) => !v)}
                className="appearance-none"
                aria-label="主食材タグを変更"
              >
                <Badge
                  variant="outline"
                  className="gap-1 cursor-pointer hover:bg-accent"
                >
                  {MainIcon && <MainIcon className="w-3 h-3" />}
                  {mainTag ?? "主食材タグ未設定"}
                  <Pencil className="w-2.5 h-2.5 opacity-60" />
                </Badge>
              </button>
            </div>

            {editingTag && (
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
            )}
          </div>

          {recipe.nutrition_tags && recipe.nutrition_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.nutrition_tags.map((t, i) => {
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

          {/* メインアクション 3 つ(shadcn Button + size lg + outline) */}
          <div className="space-y-2 pt-1">
            <ActionItem
              icon={ShoppingCart}
              label="買い物"
              onClick={openShoppingList}
            />
            <ActionItem
              icon={Video}
              label="YouTube"
              href={youtubeSearchUrl}
              external
            />
            <ActionItem
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

interface ActionItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  disabled?: boolean;
}

function ActionItem({
  icon: Icon,
  label,
  onClick,
  href,
  external,
  disabled,
}: ActionItemProps) {
  const inner = (
    <>
      <Icon className="w-5 h-5" />
      <span className="flex-1 text-left text-base font-medium">{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </>
  );

  if (href && !disabled) {
    return (
      <Button
        asChild
        variant="outline"
        size="lg"
        className="w-full justify-start gap-3 h-12"
      >
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {inner}
        </a>
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className="w-full justify-start gap-3 h-12"
    >
      {inner}
    </Button>
  );
}
