import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { DB_SCHEMA } from "@/lib/constants";
import type { PlanMapRequest, PlanMapResponse } from "@/types/api";

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function generateDates(
  startDate: string,
  rule: PlanMapRequest["repeat_rule"],
  repeatDays: number[],
  repeatUntil: string | null,
): string[] {
  if (rule === "none" || !repeatUntil) return [startDate];

  const start = new Date(startDate);
  const end = new Date(repeatUntil);
  const dates: string[] = [];

  let current = start;
  while (current <= end) {
    const dow = current.getDay(); // 0=Sun
    if (rule === "daily") {
      dates.push(toDateStr(current));
    } else if (rule === "weekdays" && dow >= 1 && dow <= 5) {
      dates.push(toDateStr(current));
    } else if (rule === "custom" && repeatDays.includes(dow)) {
      dates.push(toDateStr(current));
    }
    current = addDays(current, 1);
  }

  return dates;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: PlanMapRequest = await request.json();
    const {
      recipe_id,
      planned_date,
      meal_type,
      servings = 1,
      repeat_rule = "none",
      repeat_days = [],
      repeat_until,
    } = body;

    // Validate recipe belongs to user
    const { data: recipe } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .select("id")
      .eq("id", recipe_id)
      .eq("user_id", user.id)
      .single();
    if (!recipe)
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

    const dates = generateDates(
      planned_date,
      repeat_rule,
      repeat_days,
      repeat_until,
    );

    if (dates.length === 0) {
      return NextResponse.json(
        {
          error: "登録対象の日付がありません（曜日や終了日を確認してください）",
        },
        { status: 400 },
      );
    }

    const inserts = dates.map((date) => ({
      user_id: user.id,
      recipe_id,
      planned_date: date,
      meal_type,
      servings,
      repeat_rule,
      repeat_days: repeat_rule === "custom" ? repeat_days : null,
      repeat_until: repeat_rule !== "none" ? repeat_until : null,
    }));

    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("meal_plans")
      .insert(inserts);

    if (error) throw error;

    return NextResponse.json({
      plans_created: dates.length,
    } satisfies PlanMapResponse);
  } catch (error) {
    console.error("Plan map error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `献立の登録に失敗しました: ${detail}` },
      { status: 500 },
    );
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

    const { id } = (await request.json()) as { id: string };
    await supabase
      .schema(DB_SCHEMA)
      .from("meal_plans")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
