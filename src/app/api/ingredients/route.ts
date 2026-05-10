import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import type { IngredientInfo } from "@/types/database";

/**
 * GET /api/ingredients?name=<日本語名>
 *   食材辞典 (cookgo.ingredient_info) から該当食材の情報を返す。
 *   - 見つからない場合 200 で { info: null }
 *   - スペース・大小文字差を吸収するため lower(name) でも検索を試みる
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "name クエリは必須です" },
        { status: 400 },
      );
    }

    const exact = await supabase
      .schema(DB_SCHEMA)
      .from("ingredient_info")
      .select("*")
      .eq("name", name)
      .maybeSingle();
    if (exact.data) {
      return NextResponse.json({ info: exact.data as IngredientInfo });
    }

    const lowered = await supabase
      .schema(DB_SCHEMA)
      .from("ingredient_info")
      .select("*")
      .ilike("name", name)
      .maybeSingle();
    if (lowered.data) {
      return NextResponse.json({ info: lowered.data as IngredientInfo });
    }

    return NextResponse.json({ info: null });
  } catch (error) {
    console.error("ingredients GET error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `取得に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
