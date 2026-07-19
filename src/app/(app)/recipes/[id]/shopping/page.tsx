import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ShoppingClient } from "./shopping-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipeShoppingPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const recipe = await db.recipes.getById(supabase, user.id, id);
  if (!recipe) notFound();

  return <ShoppingClient recipe={recipe} />;
}
