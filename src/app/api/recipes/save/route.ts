import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { fetchRecipeImage } from "@/lib/image-query";
import { translateNames, translateTitle } from "@/lib/translate";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DraftRecipe,
  RecipeSaveRequest,
  RecipeSaveResponse,
} from "@/types/api";
import type { RecipeIngredient, RecipeSourceTag } from "@/types/database";

async function enrichIngredients(
  ingredients: RecipeIngredient[],
  pantryNames: Set<string>,
): Promise<RecipeIngredient[]> {
  // 翻訳または「other / 未指定」カテゴリ補完が必要な食材
  const needsWork = Array.from(
    new Set(
      ingredients
        .filter(
          (i) =>
            i.name &&
            (!i.name_en || !i.name_vi || !i.category || i.category === "other"),
        )
        .map((i) => i.name),
    ),
  );
  const translations =
    needsWork.length > 0
      ? await translateNames(needsWork, { needCategory: true })
      : {};
  return ingredients.map((ing) => {
    const t = translations[ing.name];
    const inferredCategory =
      t?.category && t.category !== "other" ? t.category : null;
    return {
      name: ing.name,
      name_en: ing.name_en ?? t?.en ?? null,
      name_vi: ing.name_vi ?? t?.vi ?? null,
      amount: ing.amount ?? "",
      unit: ing.unit ?? "",
      in_pantry: pantryNames.has((ing.name ?? "").toLowerCase()),
      category:
        ing.category && ing.category !== "other"
          ? ing.category
          : (inferredCategory ?? ing.category ?? "other"),
    };
  });
}

async function buildPayload(
  draft: DraftRecipe,
  imageUrl: string | null,
  pantryNames: Set<string>,
  source_tag: RecipeSourceTag,
) {
  const ingredients = await enrichIngredients(
    draft.ingredients ?? [],
    pantryNames,
  );
  return {
    title: draft.title,
    title_en: draft.title_en ?? null,
    description: draft.description ?? null,
    prep_time_min: draft.prep_time_min,
    is_meal_prep_friendly: false,
    meal_prep_days: null,
    servings: 1,
    ingredients,
    steps: draft.steps ?? [],
    ai_generated: source_tag === "ai_suggest",
    is_tried: false,
    image_url: imageUrl,
    source_tag,
  };
}

async function getPantryNames(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .schema(DB_SCHEMA)
    .from("pantry_items")
    .select("name")
    .eq("user_id", userId)
    .eq("in_stock", true);
  return new Set((data ?? []).map((p) => p.name.toLowerCase()));
}

async function ensureTitleEn(draft: DraftRecipe): Promise<string | null> {
  if (draft.title_en?.trim()) return draft.title_en.trim();
  if (!draft.title?.trim()) return null;
  return await translateTitle(draft.title.trim());
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as RecipeSaveRequest;
    const draft = body.recipe;
    if (!draft || !draft.title?.trim())
      return NextResponse.json(
        { error: "タイトルは必須です" },
        { status: 400 },
      );

    const source_tag: RecipeSourceTag =
      body.source_tag === "ai_suggest"
        ? "ai_suggest"
        : body.source_tag === "delivery"
          ? "delivery"
          : "self";

    const pantryNames = await getPantryNames(supabase, user.id);
    const titleEn = await ensureTitleEn(draft);
    const enrichedDraft: DraftRecipe = { ...draft, title_en: titleEn };
    const imageUrl = await fetchRecipeImage({
      title: enrichedDraft.title,
      title_en: enrichedDraft.title_en,
      description: enrichedDraft.description,
      ingredients: enrichedDraft.ingredients ?? [],
    });

    const payload = await buildPayload(
      enrichedDraft,
      imageUrl,
      pantryNames,
      source_tag,
    );

    const { data, error } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .insert({ user_id: user.id, ...payload })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({
      recipe_id: data.id,
    } satisfies RecipeSaveResponse);
  } catch (error) {
    console.error("save POST error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `保存に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id)
      return NextResponse.json(
        { error: "id クエリは必須です" },
        { status: 400 },
      );

    const body = (await request.json()) as RecipeSaveRequest;
    const draft = body.recipe;
    if (!draft || !draft.title?.trim())
      return NextResponse.json(
        { error: "タイトルは必須です" },
        { status: 400 },
      );

    const { data: existing } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .select("title, title_en, image_url, source_tag")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const pantryNames = await getPantryNames(supabase, user.id);
    const titleEn = await ensureTitleEn(draft);
    const enrichedDraft: DraftRecipe = { ...draft, title_en: titleEn };

    let imageUrl = existing.image_url as string | null;
    const titleChanged = draft.title.trim() !== (existing.title as string);
    const titleEnChanged = titleEn !== (existing.title_en as string | null);
    if (titleChanged || titleEnChanged) {
      const newImg = await fetchRecipeImage({
        title: enrichedDraft.title,
        title_en: enrichedDraft.title_en,
        description: enrichedDraft.description,
        ingredients: enrichedDraft.ingredients ?? [],
      });
      if (newImg) imageUrl = newImg;
    }

    const requested = body.source_tag;
    const source_tag: RecipeSourceTag =
      requested === "self" ||
      requested === "ai_suggest" ||
      requested === "delivery"
        ? requested
        : ((existing.source_tag as RecipeSourceTag | null) ?? "self");

    const payload = await buildPayload(
      enrichedDraft,
      imageUrl,
      pantryNames,
      source_tag,
    );

    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    return NextResponse.json({
      recipe_id: id,
    } satisfies RecipeSaveResponse);
  } catch (error) {
    console.error("save PUT error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `更新に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
