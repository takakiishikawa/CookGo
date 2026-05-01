import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RecipeDetailClient } from "./recipe-detail-client";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const recipe = await db.recipes.getById(supabase, user.id, id);

  if (!recipe) notFound();

  return <RecipeDetailClient recipe={recipe} />;
}
