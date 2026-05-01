import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET } from "./constants";
import type { DraftRecipe } from "@/types/api";
import type { RecipeIngredient, RecipeStep } from "@/types/database";

const anthropic = new Anthropic();

export const SCHEMA_SAMPLE = `{
  "title": "豚の生姜焼き",
  "title_en": "Ginger Pork",
  "description": "1〜2文の説明",
  "prep_time_min": 20,
  "servings": 1,
  "ingredients": [
    {
      "name": "豚ロース",
      "amount": "150",
      "unit": "g",
      "category": "protein"
    },
    {
      "name": "醤油",
      "amount": "大さじ2",
      "unit": "",
      "category": "seasoning"
    }
  ],
  "steps": [
    { "order": 1, "text": "豚肉を一口大に切る", "image_query": "slicing pork loin" },
    { "order": 2, "text": "フライパンで両面焼く", "image_query": "pan frying pork" }
  ]
}`;

export const FIXED_CONSTRAINTS = `【固定条件（最優先・必ず守る）】
- 1食分（servings = 1）として出力
- ホーチミン市内のスーパーで手に入る食材を使用
- 調理時間は60分以内
- 食材は具体的に種目まで（例：「肉」ではなく「豚バラ肉」「鶏もも肉」など）
- ingredients[*].unit は数値量のときは "g" / "ml" など。"大さじ2" のように amount に単位が含まれる場合は空文字 ""
- name_en / name_vi はサーバー側で後から自動付与するため出力不要（出力しても無視される）
- steps[*].image_query は 各調理過程の写真検索用に英語で具体的に書く（必須・各ステップ毎に）`;

export interface RawDraft {
  title?: unknown;
  title_en?: unknown;
  description?: unknown;
  prep_time_min?: unknown;
  is_meal_prep_friendly?: unknown;
  meal_prep_days?: unknown;
  servings?: unknown;
  ingredients?: unknown;
  steps?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizeIngredient(raw: unknown): RecipeIngredient | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = asString(r.name);
  if (!name) return null;
  return {
    name,
    name_en: asString(r.name_en),
    name_vi: asString(r.name_vi),
    amount:
      typeof r.amount === "number"
        ? String(r.amount)
        : (asString(r.amount) ?? ""),
    unit: asString(r.unit) ?? "",
    category: asString(r.category),
  };
}

function normalizeStep(raw: unknown): RecipeStep | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = asString(r.text);
  if (!text) return null;
  return {
    order: asNumber(r.order) ?? 0,
    text,
    image_query: asString(r.image_query),
  };
}

export function normalizeDraft(raw: RawDraft): DraftRecipe | null {
  const title = asString(raw.title);
  if (!title) return null;
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients
        .map(normalizeIngredient)
        .filter((i): i is RecipeIngredient => i !== null)
    : [];
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map(normalizeStep).filter((s): s is RecipeStep => s !== null)
    : [];
  return {
    title,
    title_en: asString(raw.title_en),
    description: asString(raw.description),
    prep_time_min: asNumber(raw.prep_time_min),
    is_meal_prep_friendly: raw.is_meal_prep_friendly === true,
    meal_prep_days: asNumber(raw.meal_prep_days),
    servings: asNumber(raw.servings) ?? 1,
    ingredients,
    steps,
  };
}

export async function callClaudeJson(prompt: string): Promise<unknown> {
  const response = await anthropic.messages.create({
    model: CLAUDE_SONNET,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claudeの応答からJSONを抽出できませんでした");
  try {
    return JSON.parse(match[0]) as unknown;
  } catch {
    throw new Error("Claudeの応答JSONが不正です");
  }
}
