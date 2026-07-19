import type { DraftRecipe } from "@/types/api";

/**
 * Imports a Discover item's source URL into the user's Kitchen, reusing the
 * same import→save pipeline as the paste-a-link Add Recipe flow.
 */
export async function saveDiscoverItem(
  sourceUrl: string,
): Promise<{ recipeId: string }> {
  const importRes = await fetch("/api/recipes/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: sourceUrl }),
  });
  if (importRes.status === 422) {
    const data = await importRes.json();
    throw new Error(data.message ?? "サイトを読み取れませんでした");
  }
  const importData = await importRes.json();
  if (importData.error) throw new Error(importData.error);
  const draft = importData.draft as DraftRecipe;

  const saveRes = await fetch("/api/recipes/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipe: draft,
      source_tag: draft.source_tag ?? "ai_suggest",
    }),
  });
  const saveData = await saveRes.json();
  if (saveData.error) throw new Error(saveData.error);
  return { recipeId: saveData.recipe_id as string };
}
