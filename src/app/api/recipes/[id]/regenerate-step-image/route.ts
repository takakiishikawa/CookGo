import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { generateStepImageQueries } from "@/lib/step-image-queries";
import type { RecipeStep } from "@/types/database";

export const maxDuration = 30;

interface RegenerateStepImageRequest {
  /** 0-based の steps 配列 index */
  stepIndex: number;
}

/**
 * 単一ステップの image_query のみを再生成する。
 * レシピ全体を context として渡すが、戻り値は対象ステップの新クエリのみ。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as RegenerateStepImageRequest;
    const targetIndex = Number(body.stepIndex);
    if (!Number.isFinite(targetIndex) || targetIndex < 0) {
      return NextResponse.json(
        { error: "stepIndex が不正です" },
        { status: 400 },
      );
    }

    const { data: recipe, error: getErr } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .select("title, title_en, description, ingredients, steps")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (getErr || !recipe)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const steps = ([...((recipe.steps as RecipeStep[] | null) ?? [])]).sort(
      (a, b) => a.order - b.order,
    );
    if (targetIndex >= steps.length) {
      return NextResponse.json(
        { error: "stepIndex が範囲外です" },
        { status: 400 },
      );
    }

    // バリエーションを生むために乱数をプロンプトに混ぜたいが、シンプルに毎回 generate
    const queries = await generateStepImageQueries({
      title: recipe.title,
      title_en: recipe.title_en,
      description: recipe.description,
      ingredients: recipe.ingredients,
      steps,
    });

    const newQuery = queries[targetIndex] ?? steps[targetIndex].image_query;
    const updatedSteps = steps.map((s, i) =>
      i === targetIndex ? { ...s, image_query: newQuery } : s,
    );

    const { error: updateErr } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .update({ steps: updatedSteps })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updateErr) throw updateErr;

    return NextResponse.json({
      stepIndex: targetIndex,
      image_query: newQuery,
    });
  } catch (error) {
    console.error("regenerate-step-image error:", error);
    const detail =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `画像クエリの再生成に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
