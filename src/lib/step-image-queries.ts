import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_HAIKU } from "./constants";
import type { RecipeIngredient, RecipeStep } from "@/types/database";

const client = new Anthropic();

interface RecipeContext {
  title: string;
  title_en?: string | null;
  description?: string | null;
  ingredients: RecipeIngredient[] | null | undefined;
  steps: RecipeStep[];
}

/**
 * レシピ全体を文脈に与えて、各ステップの Unsplash 検索クエリを英語で再生成する。
 * - 写真風・上から見た構図・自然光・料理写真の一貫性を意識
 * - 失敗時は元の image_query / フォールバックに維持
 */
export async function generateStepImageQueries(
  recipe: RecipeContext,
): Promise<string[]> {
  if (recipe.steps.length === 0) return [];

  const ingredients = (recipe.ingredients ?? [])
    .slice(0, 10)
    .map((i) => i.name_en || i.name)
    .filter(Boolean)
    .join(", ");

  const stepText = recipe.steps
    .map((s, i) => `${i + 1}. ${s.text}`)
    .join("\n");

  const prompt = `You are generating Unsplash photo search queries for each step of a Japanese recipe.

Goal: photo-realistic, overhead/top-down composition, natural light, consistent food-photography style across all steps so the recipe looks coherent.

Rules per query:
- 4-7 English words
- Reflect what the cook is actually doing in that step (chopping, marinating, pan-frying, plating, simmering, etc.)
- Reference key ingredients/utensils when helpful (skillet, knife, bowl)
- Include a style hint when natural ("overhead", "top-down", "natural light", "food photography")
- DO NOT include quotes, markdown, numbering, or extra punctuation in the query
- Avoid abstract single words ("food", "cooking") — be concrete

Recipe context:
- Title (ja): ${recipe.title}
- Title (en): ${recipe.title_en ?? "(none)"}
- Description: ${recipe.description ?? "(none)"}
- Main ingredients: ${ingredients || "(none)"}

Steps (numbered):
${stepText}

Output STRICT JSON only (no code fences, no commentary):
{
  "queries": ["query for step 1", "query for step 2", "..."]
}`;

  try {
    const response = await client.messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON in response");
    const parsed = JSON.parse(match[0]) as { queries?: unknown };
    const queries = Array.isArray(parsed.queries) ? parsed.queries : [];
    return recipe.steps.map((s, i) => {
      const q = queries[i];
      if (typeof q === "string" && q.trim()) {
        return q.trim().replace(/^["'`]|["'`]$/g, "");
      }
      // fallback: 既存の image_query / 簡易フォールバック
      return s.image_query?.trim() || `${recipe.title_en ?? recipe.title} step`;
    });
  } catch (e) {
    console.error("generateStepImageQueries failed:", e);
    return recipe.steps.map(
      (s) =>
        s.image_query?.trim() || `${recipe.title_en ?? recipe.title} step`,
    );
  }
}
