import type { Recipe } from "@/types/database";

export async function fetchRecipe(id: string): Promise<Recipe> {
  const res = await fetch(`/api/recipes/${id}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.recipe as Recipe;
}
