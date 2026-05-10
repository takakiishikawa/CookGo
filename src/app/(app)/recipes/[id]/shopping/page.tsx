import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DB_SCHEMA } from "@/lib/constants";
import type { RecipeShoppingStateItem } from "@/types/database";
import { ShoppingClient } from "./shopping-client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ servings?: string }>;
}

export default async function RecipeShoppingPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [recipe, inventory] = await Promise.all([
    db.recipes.getById(supabase, user.id, id),
    db.inventory.getAll(supabase, user.id),
  ]);
  if (!recipe) notFound();

  const { data: stateRow } = await supabase
    .schema(DB_SCHEMA)
    .from("recipe_shopping_state")
    .select("state")
    .eq("user_id", user.id)
    .eq("recipe_id", id)
    .maybeSingle();

  const initialItems: RecipeShoppingStateItem[] = Array.isArray(
    (stateRow?.state as { items?: unknown } | null)?.items,
  )
    ? (stateRow!.state as { items: RecipeShoppingStateItem[] }).items
    : [];

  const initialServings = Number(sp.servings);
  const hasShoppingState = !!stateRow;

  return (
    <ShoppingClient
      recipe={recipe}
      inventoryNames={inventory.map((i) => i.name)}
      initialItems={initialItems}
      hasShoppingState={hasShoppingState}
      initialServings={
        Number.isFinite(initialServings) && initialServings > 0
          ? initialServings
          : Math.max(1, recipe.servings || 1)
      }
    />
  );
}
