"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Camera,
  ExternalLink,
  RefreshCw,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  Video,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Badge, Button, toast } from "@takaki/go-design-system";
import type { Recipe } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/constants";
import { extractCountryFlag } from "@/lib/utils";

interface RecipeDetailClientProps {
  recipe: Recipe;
}

const MAX_THUMBNAIL_SIZE_MB = 5;

export function RecipeDetailClient({ recipe }: RecipeDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(recipe.image_url);
  const [uploading, setUploading] = useState(false);

  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.title + " 作り方")}`;
  const flag = extractCountryFlag(recipe.country_tag);

  const deleteRecipe = async () => {
    if (!confirm(`「${recipe.title}」を削除しますか?`)) return;
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("削除しました");
      router.push("/recipes");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const openShoppingList = () => {
    router.push(`/recipes/${recipe.id}/shopping`);
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
    <div className="flex flex-col">
      <AppHeader
        breadcrumbs={[
          { label: "レシピ", href: "/recipes" },
          { label: recipe.title },
        ]}
      />

      <div className="px-4 md:px-8 pt-6 pb-12 space-y-6 max-w-2xl">
        {/* ===== 画像 + タイトル + 説明 ===== */}
        <div className="flex gap-4 items-start">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={recipe.title}
                fill
                sizes="(min-width: 640px) 160px, 128px"
                priority
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <UtensilsCrossed
                  className="w-10 h-10 text-muted-foreground/40"
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
              className="absolute bottom-1.5 right-1.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 backdrop-blur text-white hover:bg-black/80 transition-colors disabled:opacity-50"
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
          <div className="flex-1 min-w-0 space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold leading-tight">
              {flag && <span className="mr-1.5">{flag}</span>}
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {recipe.description}
              </p>
            )}
          </div>
        </div>

        {/* ===== 分類タグ (発祥国 + 主食材) ===== */}
        {(recipe.country_tag || recipe.main_ingredient_tag) && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.country_tag && (
              <Badge variant="outline" className="text-xs font-normal">
                {recipe.country_tag}
              </Badge>
            )}
            {recipe.main_ingredient_tag && (
              <Badge variant="outline" className="text-xs font-normal">
                {recipe.main_ingredient_tag}
              </Badge>
            )}
          </div>
        )}

        {/* ===== 栄養プロファイルタグ ===== */}
        {recipe.nutrition_tags && recipe.nutrition_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.nutrition_tags.map((t, i) => (
              <Badge
                key={`${t}-${i}`}
                variant="secondary"
                className="text-xs font-normal"
              >
                {t}
              </Badge>
            ))}
          </div>
        )}

        {/* ===== メインアクション 3 つ + 削除 ===== */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openShoppingList} className="gap-1.5" size="sm">
            <ShoppingCart className="w-4 h-4" />
            買い物
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <a
              href={youtubeSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Video className="w-3.5 h-3.5 text-destructive" />
              YouTube
            </a>
          </Button>
          {recipe.source_url && (
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                元レシピ
              </a>
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={deleteRecipe}
            aria-label="削除"
            title="削除"
            className="ml-auto w-7 h-7 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
