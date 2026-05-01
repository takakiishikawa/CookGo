import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { fetchRecipeImage } from "@/lib/image-query";
import { generateStepImageQueries } from "@/lib/step-image-queries";
import { translateNames, translateTitle } from "@/lib/translate";
import type {
  DraftRecipe,
  RecipeSaveRequest,
  RecipeSaveResponse,
} from "@/types/api";
import type {
  RecipeIngredient,
  RecipeSourceTag,
  RecipeStep,
} from "@/types/database";

async function enrichIngredients(
  ingredients: RecipeIngredient[],
): Promise<RecipeIngredient[]> {
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
      category:
        ing.category && ing.category !== "other"
          ? ing.category
          : (inferredCategory ?? ing.category ?? "other"),
    };
  });
}

async function enhanceSteps(
  draft: DraftRecipe,
  ingredients: RecipeIngredient[],
): Promise<RecipeStep[]> {
  const baseSteps = draft.steps ?? [];
  if (baseSteps.length === 0) return baseSteps;
  const queries = await generateStepImageQueries({
    title: draft.title,
    title_en: draft.title_en,
    description: draft.description,
    ingredients,
    steps: baseSteps,
  });
  return baseSteps.map((s, i) => ({
    ...s,
    image_query: queries[i] ?? s.image_query,
  }));
}

async function buildPayload(
  draft: DraftRecipe,
  imageUrl: string | null,
  source_tag: RecipeSourceTag,
) {
  const ingredients = await enrichIngredients(draft.ingredients ?? []);
  const steps = await enhanceSteps(draft, ingredients);
  return {
    title: draft.title,
    title_en: draft.title_en ?? null,
    description: draft.description ?? null,
    prep_time_min: draft.prep_time_min,
    is_meal_prep_friendly: false,
    meal_prep_days: null,
    servings: draft.servings ?? 1,
    ingredients,
    steps,
    ai_generated: source_tag === "ai_suggest",
    image_url: imageUrl,
    source_tag,
    source_url: draft.source_url ?? null,
  };
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

    const titleEn = await ensureTitleEn(draft);
    const enrichedDraft: DraftRecipe = { ...draft, title_en: titleEn };
    // ドラフトに既に image_url がある(URL取り込み時の og:image 等)場合はそれを採用、
    // なければ Unsplash で生成
    const imageUrl =
      draft.image_url ??
      (await fetchRecipeImage({
        title: enrichedDraft.title,
        title_en: enrichedDraft.title_en,
        description: enrichedDraft.description,
        ingredients: enrichedDraft.ingredients ?? [],
      }));

    const payload = await buildPayload(enrichedDraft, imageUrl, source_tag);

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

    const payload = await buildPayload(enrichedDraft, imageUrl, source_tag);

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
