import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DB_SCHEMA } from "@/lib/constants";
import { DashboardClient } from "./dashboard-client";
import { type MealPlanWithRecipe } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: todayPlansData } = await supabase
    .schema(DB_SCHEMA)
    .from("meal_plans")
    .select("*, recipe:recipes(id, title, title_en, image_url)")
    .eq("user_id", user.id)
    .eq("planned_date", todayStr);
  const todayPlans = (todayPlansData ?? []) as unknown as MealPlanWithRecipe[];

  const [todayLogs, recipes] = await Promise.all([
    db.foodLogs.getByDate(supabase, user.id, todayStr),
    db.recipes.getAll(supabase, user.id, 200),
  ]);

  return (
    <DashboardClient
      initialDate={todayStr}
      initialDateLogs={todayLogs}
      initialDatePlans={todayPlans}
      recipes={recipes}
    />
  );
}
