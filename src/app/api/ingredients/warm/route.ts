/**
 * POST /api/ingredients/warm
 *   一覧の食材のうち、まだ ingredient_info テーブルに無いものだけ Sonnet で並列生成
 *   して upsert する。すべて存在する場合は AI コール 0 で即返す。
 *
 *   shopping ページから fire-and-forget で呼び、popup が常に即時表示されるようにする
 *   (旧レシピでは save 時に warm されないため、ここで補う)。
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { generateIngredientInfo } from "@/lib/ingredient-info-ai";
import type { RecipeIngredient } from "@/types/database";

export const maxDuration = 60;

interface Body {
  ingredients: Pick<
    RecipeIngredient,
    "name" | "name_en" | "name_vi" | "category"
  >[];
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
    const ings = (body.ingredients ?? []).filter(
      (i) => typeof i?.name === "string" && i.name.trim().length > 0,
    );
    if (ings.length === 0) {
      return NextResponse.json({ warmed: 0, skipped: 0 });
    }

    const names = Array.from(new Set(ings.map((i) => i.name.trim())));
    const { data: existing } = await supabase
      .schema(DB_SCHEMA)
      .from("ingredient_info")
      .select("name")
      .in("name", names);
    const have = new Set(
      ((existing as { name: string }[] | null) ?? []).map((r) => r.name),
    );

    const seen = new Set<string>();
    const missing = ings.filter((i) => {
      const k = i.name.trim();
      if (have.has(k)) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (missing.length === 0) {
      return NextResponse.json({ warmed: 0, skipped: ings.length });
    }

    const results = await Promise.allSettled(
      missing.map((i) =>
        generateIngredientInfo({
          name: i.name,
          name_en: i.name_en ?? null,
          name_vi: i.name_vi ?? null,
          category: i.category ?? null,
        }),
      ),
    );

    const rows = results
      .filter(
        (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof generateIngredientInfo>>>> =>
          r.status === "fulfilled" && r.value !== null,
      )
      .map((r) => r.value);

    if (rows.length > 0) {
      const { error } = await supabase
        .schema(DB_SCHEMA)
        .from("ingredient_info")
        .upsert(rows, { onConflict: "name", ignoreDuplicates: true });
      if (error) {
        console.warn("warm upsert failed:", error.message);
      }
    }

    return NextResponse.json({
      warmed: rows.length,
      skipped: ings.length - missing.length,
    });
  } catch (error) {
    console.error("ingredients/warm error:", error);
    return NextResponse.json(
      { error: "warm failed" },
      { status: 500 },
    );
  }
}
