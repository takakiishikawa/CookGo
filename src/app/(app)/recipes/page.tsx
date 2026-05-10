import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { RecipesClient } from "./recipes-client";

export default async function RecipesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [recipes, staples, inventory] = await Promise.all([
    db.recipes.getAll(supabase, user.id),
    db.staples.getAll(supabase, user.id),
    db.inventory.getAll(supabase, user.id),
  ]);

  return (
    <RecipesClient
      recipes={recipes}
      staples={staples}
      inventory={inventory}
      userId={user.id}
    />
  );
}
