import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { EXERCISE_NAMES } from "@/types/database";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    exercise_id,
    exercise_name,
    weight_kg,
    reps,
    record_type,
    recorded_at,
  } = body;

  const isPullUp = exercise_name === EXERCISE_NAMES.PULL_UP;

  const { data: prevRecords } = await supabase
    .schema(DB_SCHEMA)
    .from("personal_records")
    .select("weight_kg, reps")
    .eq("user_id", user.id)
    .eq("exercise_id", exercise_id);

  const prevBest = prevRecords?.length
    ? isPullUp
      ? Math.max(...prevRecords.map((r) => r.reps ?? 0))
      : Math.max(...prevRecords.map((r) => r.weight_kg ?? 0))
    : null;

  const currentValue = isPullUp ? reps : weight_kg;
  const is_pr = prevBest === null || currentValue > prevBest;

  const { data, error } = await supabase
    .schema(DB_SCHEMA)
    .from("personal_records")
    .insert({
      user_id: user.id,
      exercise_id,
      weight_kg: weight_kg ?? null,
      reps: reps ?? null,
      record_type,
      is_pr,
      recorded_at: recorded_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ...data, is_pr });
}
