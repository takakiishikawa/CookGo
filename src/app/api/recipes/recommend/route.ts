import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  searchRecipes,
  type RecipeRecommendation,
} from "@/lib/recipe-recommend";

export const maxDuration = 60;

interface RecommendRequest {
  query: string;
}

export interface RecipeRecommendResponse {
  recommendations: RecipeRecommendation[];
}

export type { RecipeRecommendation };

/**
 * No UI currently calls this (Add Recipe ships paste-only per the HomeCook
 * redesign) — kept live for manual prompt-quality testing. The Discover
 * feed's weekly refresh job (/api/discover/refresh) is the primary caller
 * of the underlying searchRecipes() logic now.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { query } = (await request.json()) as RecommendRequest;
    const trimmed = (query ?? "").trim();
    if (!trimmed)
      return NextResponse.json(
        { error: "検索キーワードを入力してください" },
        { status: 400 },
      );

    const recommendations = await searchRecipes(trimmed, 10);
    return NextResponse.json({
      recommendations,
    } satisfies RecipeRecommendResponse);
  } catch (error) {
    console.error("recommend error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `レシピ検索に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
