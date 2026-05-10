/**
 * POST /api/ingredients/generate
 *   食材辞典に未登録の食材を Claude Sonnet で生成し、ingredient_info テーブルへ upsert。
 *   既存があればそれを返却(=AI を呼ばない)。
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { generateIngredientInfo } from "@/lib/ingredient-info-ai";
import type { IngredientInfo } from "@/types/database";

export const maxDuration = 60;

interface Body {
  name: string;
  name_en?: string | null;
  name_vi?: string | null;
  category?: string | null;
  /** true で既存があっても AI で再生成する(リフレッシュ用) */
  force?: boolean;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as Body;
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "name は必須です" },
        { status: 400 },
      );
    }

    if (!body.force) {
      const existing = await supabase
        .schema(DB_SCHEMA)
        .from("ingredient_info")
        .select("*")
        .eq("name", name)
        .maybeSingle();
      if (existing.data) {
        return NextResponse.json({ info: existing.data as IngredientInfo });
      }
    }

    const row = await generateIngredientInfo({
      name,
      name_en: body.name_en ?? null,
      name_vi: body.name_vi ?? null,
      category: body.category ?? null,
    });
    if (!row) {
      return NextResponse.json(
        { error: "Claudeの応答からJSONを抽出できませんでした" },
        { status: 500 },
      );
    }

    const upsert = await supabase
      .schema(DB_SCHEMA)
      .from("ingredient_info")
      .upsert(row, { onConflict: "name", ignoreDuplicates: false })
      .select()
      .single();

    if (upsert.error) {
      console.error("ingredient_info upsert failed:", upsert.error);
      return NextResponse.json(
        { error: `保存に失敗しました: ${upsert.error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ info: upsert.data as IngredientInfo });
  } catch (error) {
    console.error("ingredients/generate error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `生成に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
