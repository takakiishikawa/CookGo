import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { fetchRecipeImage } from "@/lib/image-query";
import { inferCategoryFromName } from "@/lib/ingredient-categories";
import { translateNames, translateTitle } from "@/lib/translate";
import { generateIngredientInfo } from "@/lib/ingredient-info-ai";
import type {
  DraftRecipe,
  IngredientInfoDraft,
  RecipeSaveRequest,
  RecipeSaveResponse,
} from "@/types/api";
import type { RecipeIngredient, RecipeSourceTag } from "@/types/database";

export const maxDuration = 60;

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
    const aiCategory =
      t?.category && t.category !== "other" ? t.category : null;
    // 既存値 → AI 推定 → 名前 (ja/en) からのキーワード推定 → "other"
    const keywordCategory =
      inferCategoryFromName(ing.name) ??
      inferCategoryFromName(ing.name_en ?? t?.en ?? null);
    const finalCategory =
      ing.category && ing.category !== "other"
        ? ing.category
        : (aiCategory ?? keywordCategory ?? ing.category ?? "other");
    return {
      name: ing.name,
      name_en: ing.name_en ?? t?.en ?? null,
      name_vi: ing.name_vi ?? t?.vi ?? null,
      amount: ing.amount ?? "",
      unit: ing.unit ?? "",
      category: finalCategory,
    };
  });
}

function buildPayload(
  draft: DraftRecipe,
  ingredients: RecipeIngredient[],
  imageUrl: string | null,
  source_tag: RecipeSourceTag,
) {
  return {
    title: draft.title,
    title_en: draft.title_en ?? null,
    description: draft.description ?? null,
    prep_time_min: draft.prep_time_min,
    is_meal_prep_friendly: false,
    meal_prep_days: null,
    servings: draft.servings ?? 1,
    ingredients,
    ai_generated: source_tag === "ai_suggest",
    image_url: imageUrl,
    source_tag,
    source_url: draft.source_url ?? null,
    main_ingredient_tag: draft.main_ingredient_tag ?? null,
    country_tag: draft.country_tag ?? null,
    nutrition_tags: draft.nutrition_tags ?? [],
  };
}

async function ensureTitleEn(draft: DraftRecipe): Promise<string | null> {
  if (draft.title_en?.trim()) return draft.title_en.trim();
  if (!draft.title?.trim()) return null;
  return await translateTitle(draft.title.trim());
}

/**
 * AI が生成した食材情報をグローバル ingredient_info テーブルへ upsert。
 * name は UNIQUE。先に登録された情報を上書きしない方針(ON CONFLICT DO NOTHING 相当)。
 */
async function upsertIngredientInfo(
  supabase: SupabaseClient,
  infos: IngredientInfoDraft[] | undefined,
) {
  if (!infos || infos.length === 0) return;
  const rows = infos
    .filter((i) => i.name?.trim())
    .map((i) => ({
      name: i.name.trim(),
      name_en: i.name_en,
      name_vi: i.name_vi,
      category: i.category,
      origin: i.origin,
      composition: i.composition,
      taste_profile: i.taste_profile,
      pairings: i.pairings ?? [],
      alternatives: i.alternatives ?? [],
      nutrition_tags: i.nutrition_tags ?? [],
    }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .schema(DB_SCHEMA)
    .from("ingredient_info")
    .upsert(rows, { onConflict: "name", ignoreDuplicates: true });
  if (error) {
    console.warn("ingredient_info upsert failed:", error.message);
  }
}

/**
 * レシピの全食材について、まだ DB に存在しない ingredient_info を Sonnet で並列生成して
 * upsert する。これで食材ポップアップは常に即時表示できる。
 * 失敗してもレシピ保存自体はブロックしない(警告ログのみ)。
 */
async function ensureAllIngredientInfo(
  supabase: SupabaseClient,
  ingredients: RecipeIngredient[],
) {
  const names = Array.from(
    new Set(
      ingredients
        .map((i) => i.name?.trim())
        .filter((n): n is string => !!n),
    ),
  );
  if (names.length === 0) return;

  const { data: existing } = await supabase
    .schema(DB_SCHEMA)
    .from("ingredient_info")
    .select("name")
    .in("name", names);
  const have = new Set(
    ((existing as { name: string }[] | null) ?? []).map((r) => r.name),
  );

  const missing = ingredients.filter(
    (i) => i.name && !have.has(i.name.trim()),
  );
  if (missing.length === 0) return;

  // 同じ食材名が ingredients 内に重複していたら一つにまとめる
  const seen = new Set<string>();
  const uniqueMissing = missing.filter((i) => {
    const k = i.name.trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const generated = await Promise.allSettled(
    uniqueMissing.map((ing) =>
      generateIngredientInfo({
        name: ing.name,
        name_en: ing.name_en,
        name_vi: ing.name_vi,
        category: ing.category,
      }),
    ),
  );

  const rows = generated
    .filter(
      (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof generateIngredientInfo>>>> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);

  if (rows.length === 0) return;

  const { error } = await supabase
    .schema(DB_SCHEMA)
    .from("ingredient_info")
    .upsert(rows, { onConflict: "name", ignoreDuplicates: true });
  if (error) {
    console.warn("ensureAllIngredientInfo upsert failed:", error.message);
  }
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

    const ingredients = await enrichIngredients(enrichedDraft.ingredients ?? []);
    const payload = buildPayload(enrichedDraft, ingredients, imageUrl, source_tag);

    const { data, error } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .insert({ user_id: user.id, ...payload })
      .select("id")
      .single();
    if (error) throw error;

    // AI が同梱した分を先にまとめて保存し、足りない分を Sonnet で並列補完
    await upsertIngredientInfo(supabase, draft.ingredient_info);
    await ensureAllIngredientInfo(supabase, ingredients);

    return NextResponse.json({
      recipe_id: data!.id,
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

    const ingredients = await enrichIngredients(enrichedDraft.ingredients ?? []);
    const payload = buildPayload(enrichedDraft, ingredients, imageUrl, source_tag);

    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    await upsertIngredientInfo(supabase, draft.ingredient_info);
    await ensureAllIngredientInfo(supabase, ingredients);

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
