import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";

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

    const { data: src, error: getErr } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (getErr || !src)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const insert = {
      user_id: user.id,
      title: `${src.title}（コピー）`,
      title_en: src.title_en,
      description: src.description,
      prep_time_min: src.prep_time_min,
      is_meal_prep_friendly: src.is_meal_prep_friendly ?? false,
      meal_prep_days: src.meal_prep_days,
      servings: src.servings,
      ingredients: src.ingredients,
      steps: src.steps,
      ai_generated: src.ai_generated ?? false,
      image_url: src.image_url,
      source_tag: src.source_tag ?? "self",
    };

    const { data: created, error: insErr } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .insert(insert)
      .select("id")
      .single();
    if (insErr) throw insErr;

    return NextResponse.json({ recipe_id: created.id });
  } catch (error) {
    console.error("recipe duplicate error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `複製に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
