import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { generateStepImageQueries } from "@/lib/step-image-queries";
import type { RecipeStep } from "@/types/database";

export const maxDuration = 60;

export async function POST(
  _request: Request,
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

    const { data: recipe, error: getErr } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .select("title, title_en, description, ingredients, steps")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (getErr || !recipe)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const steps = (recipe.steps as RecipeStep[] | null) ?? [];
    if (steps.length === 0) {
      return NextResponse.json({ steps: [] });
    }

    const queries = await generateStepImageQueries({
      title: recipe.title,
      title_en: recipe.title_en,
      description: recipe.description,
      ingredients: recipe.ingredients,
      steps,
    });

    const updatedSteps: RecipeStep[] = steps.map((s, i) => ({
      ...s,
      image_query: queries[i] ?? s.image_query,
    }));

    const { error: updateErr } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .update({ steps: updatedSteps })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updateErr) throw updateErr;

    return NextResponse.json({ steps: updatedSteps });
  } catch (error) {
    console.error("regenerate-step-images error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `ステップ画像クエリの再生成に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
