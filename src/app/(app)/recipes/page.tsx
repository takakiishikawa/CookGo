import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { HomeClient } from "./home-client";

export default async function RecipesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [recipes, discoverItems] = await Promise.all([
    db.recipes.getAll(supabase, user.id),
    db.discover.getActive(supabase),
  ]);

  return <HomeClient recipes={recipes} discoverItems={discoverItems} />;
}
