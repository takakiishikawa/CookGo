"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Camera,
  ExternalLink,
  Globe2,
  RefreshCw,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
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
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/constants";
import {
  MAIN_INGREDIENT_TAG_ICON,
  extractCountryName,
  stripEmoji,
} from "@/lib/recipe-tags";

interface RecipeModalProps {
  recipe: Recipe | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (recipeId: string) => void;
}

const MAX_THUMBNAIL_SIZE_MB = 5;

export function RecipeModal({
  recipe,
  onOpenChange,
  onDeleted,
}: RecipeModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const open = recipe !== null;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setImageUrl(recipe?.image_url ?? null);
  }, [recipe]);

  if (!recipe) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" />
      </Dialog>
    );
  }

  const countryName = extractCountryName(recipe.country_tag);
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

  const handleFilePicked = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    if (file.size > MAX_THUMBNAIL_SIZE_MB * 1024 * 1024) {
      toast.error(`${MAX_THUMBNAIL_SIZE_MB}MB以下の画像を選択してください`);
      return;
    }
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");

      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const path = `${user.id}/${recipe.id}-${Date.now()}.${safeExt}`;

      const upload = await supabase.storage
        .from("cookgo-recipes")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw upload.error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("cookgo-recipes").getPublicUrl(path);

      const { error } = await supabase
        .schema(DB_SCHEMA)
        .from("recipes")
        .update({ image_url: publicUrl })
        .eq("id", recipe.id);
      if (error) throw error;

      setImageUrl(publicUrl);
      toast.success("写真を変更しました");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "アップロードに失敗しました",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* 画像エリア(タイトル直前) */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={recipe.title}
              fill
              sizes="(min-width: 768px) 32rem, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <UtensilsCrossed
                className="w-12 h-12 text-muted-foreground/40"
                strokeWidth={1.5}
              />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFilePicked(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-2 right-2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/75 transition-colors disabled:opacity-50"
            aria-label="写真を変更"
            title="写真を変更"
          >
            {uploading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <DialogTitle className="text-xl md:text-2xl font-semibold leading-tight">
            {recipe.title}
          </DialogTitle>

          {recipe.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {recipe.description}
            </p>
          )}

          {/* 1行目: 分類タグ(発祥国 + 主食材) */}
          {(countryName || recipe.main_ingredient_tag) && (
            <div className="flex flex-wrap gap-1.5">
              {countryName && (
                <Badge
                  variant="outline"
                  className="gap-1 text-xs font-normal"
                >
                  <Globe2 className="w-3 h-3" />
                  {countryName}
                </Badge>
              )}
              {recipe.main_ingredient_tag && MainIcon && (
                <Badge
                  variant="outline"
                  className="gap-1 text-xs font-normal"
                >
                  <MainIcon className="w-3 h-3" />
                  {recipe.main_ingredient_tag}
                </Badge>
              )}
            </div>
          )}

          {/* 2行目: 栄養プロファイルタグ */}
          {recipe.nutrition_tags && recipe.nutrition_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.nutrition_tags.map((t, i) => {
                const label = stripEmoji(t);
                if (!label) return null;
                return (
                  <Badge
                    key={`${t}-${i}`}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    {label}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* メインアクション 3つ(モーダルの主役) */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button onClick={openShoppingList} className="gap-1.5">
              <ShoppingCart className="w-4 h-4" />
              買い物
            </Button>
            <Button variant="outline" asChild className="gap-1.5">
              <a
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Video className="w-4 h-4 text-destructive" />
                YouTube
              </a>
            </Button>
            <Button
              variant="outline"
              asChild
              className="gap-1.5"
              disabled={!recipe.source_url}
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

          {/* 削除ボタン: 誤タップ防止のため小さく下部に */}
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
