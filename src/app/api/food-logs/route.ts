import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { db } from "@/lib/db";
import type {
  FoodLogCreateRequest,
  FoodLogCreateResponse,
  FoodLogsListResponse,
} from "@/types/api";
import type { MealType } from "@/types/database";

const ALLOWED_MEAL_TYPES: ReadonlySet<MealType> = new Set([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]);

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as FoodLogCreateRequest;
    if (!body.recipe_id)
      return NextResponse.json(
        { error: "recipe_id は必須です" },
        { status: 400 },
      );
    if (!body.logged_date || !isValidDate(body.logged_date))
      return NextResponse.json(
        { error: "logged_date が不正です" },
        { status: 400 },
      );
    if (!ALLOWED_MEAL_TYPES.has(body.meal_type))
      return NextResponse.json(
        { error: "meal_type が不正です" },
        { status: 400 },
      );

    const { data: recipe } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .select("id")
      .eq("id", body.recipe_id)
      .eq("user_id", user.id)
      .single();
    if (!recipe)
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

    const servings = body.servings ?? 1;
    const overrides = body.overrides ?? null;

    const { data: inserted, error } = await supabase
      .schema(DB_SCHEMA)
      .from("food_logs")
      .insert({
        user_id: user.id,
        recipe_id: body.recipe_id,
        logged_date: body.logged_date,
        meal_type: body.meal_type,
        servings,
        overrides,
      })
      .select("*, recipe:recipes(id, title, title_en, image_url, servings)")
      .single();
    if (error) throw error;

    return NextResponse.json({
      food_log: inserted,
    } as FoodLogCreateResponse);
  } catch (error) {
    console.error("food-logs POST error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `記録に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (date) {
      if (!isValidDate(date))
        return NextResponse.json({ error: "date が不正" }, { status: 400 });
      const logs = await db.foodLogs.getByDate(supabase, user.id, date);
      return NextResponse.json({ logs } satisfies FoodLogsListResponse);
    }
    if (start && end) {
      if (!isValidDate(start) || !isValidDate(end))
        return NextResponse.json(
          { error: "start/end が不正" },
          { status: 400 },
        );
      const logs = await db.foodLogs.getByDateRange(
        supabase,
        user.id,
        start,
        end,
      );
      return NextResponse.json({ logs } satisfies FoodLogsListResponse);
    }
    return NextResponse.json(
      { error: "date または start&end を指定してください" },
      { status: 400 },
    );
  } catch (error) {
    console.error("food-logs GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
      return NextResponse.json({ error: "id が必要です" }, { status: 400 });

    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("food_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("food-logs DELETE error:", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
