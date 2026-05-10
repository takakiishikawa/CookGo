import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_HAIKU } from "./constants";
import type { DraftRecipe, IngredientInfoDraft } from "@/types/api";
import type {
  RecipeIngredient,
  MainIngredientTag,
  IngredientPairing,
  IngredientAlternative,
} from "@/types/database";

// Vercel 60秒制約に収めるため Haiku を使用(構造化のみで Sonnet は不要)
const anthropic = new Anthropic({ maxRetries: 0 });

export const SCHEMA_SAMPLE = `{
  "title": "豚の生姜焼き",
  "title_en": "Ginger Pork",
  "description": "1〜2文の説明",
  "prep_time_min": 20,
  "servings": 1,
  "main_ingredient_tag": "肉",
  "country_tag": "日本",
  "nutrition_tags": ["高タンパク", "ビタミンB豊富"],
  "ingredients": [
    { "name": "豚ロース", "amount": "150", "unit": "g", "category": "protein" },
    { "name": "醤油", "amount": "大さじ2", "unit": "", "category": "seasoning" }
  ],
  "ingredient_info": [
    {
      "name": "豚ロース",
      "category": "protein",
      "origin": "豚の背中側にある肉。明治期に英語の loin を音訳して『ロース』になった。",
      "composition": "豚の背中中央の筋肉。脂身が薄く層になり、加熱するとほぐれて柔らかくなる。",
      "taste_profile": "脂の甘みと淡白な肉の旨味。脂が口の中で溶けて広がるため、しっとり感じる。",
      "pairings": [
        { "food": "生姜", "reason": "豚特有の臭みを抑え、脂の重さを引き締める" }
      ],
      "alternatives": [
        { "name": "鶏もも肉", "reason": "脂身の甘みが似ていて代用しやすい" }
      ],
      "nutrition_tags": ["高タンパク", "ビタミンB豊富"]
    },
    {
      "name": "醤油",
      "category": "seasoning",
      "origin": "古代中国の『醤(ジャン)』が日本に伝わり、麹で発酵させた液体調味料として独自進化した。",
      "composition": "大豆と小麦を麹菌で発酵させ、塩水で半年〜2年熟成して搾った液体。",
      "taste_profile": "塩味と旨味(グルタミン酸)、発酵由来の香ばしさ。アミノ酸が舌の旨味受容体を強く刺激する。",
      "pairings": [
        { "food": "みりん", "reason": "甘みが塩角を丸め、テリと深みを出す" }
      ],
      "alternatives": [
        { "name": "ナンプラー", "reason": "ホーチミンで入手しやすく、塩味と旨味の系統が近い" }
      ],
      "nutrition_tags": []
    }
  ]
}`;

export const FIXED_CONSTRAINTS = `【固定条件（最優先・必ず守る）】
- 1食分（servings = 1）として出力
- ホーチミン市内のスーパーで手に入る食材を使用
- 調理時間は60分以内
- 食材は具体的に種目まで（例：「肉」ではなく「豚バラ肉」「鶏もも肉」など）
- ingredients[*].unit は数値量のときは "g" / "ml" など。"大さじ2" のように amount に単位が含まれる場合は空文字 ""
- name_en / name_vi はサーバー側で後から自動付与するため出力不要（出力しても無視される）
- 出力する全テキストには絵文字・国旗記号を含めない(プレーン日本語のみ)
- main_ingredient_tag は必須。次の 4 種から 1 つだけ選ぶ:
  - "魚" : 魚介類が主役
  - "肉" : 鶏豚牛などの獣肉が主役
  - "麺" : 麺類が主役
  - "つまみ・副菜" : 上記に当てはまらない、または小皿/酒のあて
- country_tag は必須。発祥国を日本語の国名のみで出力(絵文字や記号は付けない)。例: "日本" / "中国" / "韓国" / "タイ" / "ベトナム" / "イタリア" / "フランス" / "メキシコ" / "インド" / "アメリカ"。多国籍融合料理で迷ったら、最も近い 1 国を選ぶ
- nutrition_tags は 2〜3 個。プレーン日本語の短いラベルにする(絵文字を付けない)。例: "高タンパク" / "炭水化物中心" / "食物繊維豊富" / "ビタミンB豊富" / "マグネシウム豊富" / "良質脂質"。範囲外でも適切なら可
- ingredient_info は ingredients と同数(=各食材につき必ず1件)。各オブジェクトのフィールドは:
  - name: 対応する ingredients[*].name と完全一致
  - category: ingredients[*].category と同じ値
  - origin: 名前の由来(1〜2文)
  - composition: 何でできているか・どう作られているか(2〜3文。素人にわかる表現で)
  - taste_profile: 感じる味と、なぜそう感じるかの仕組み(1〜2文)
  - pairings: 相性のいい食材 1〜3 個。各 { food, reason } で reason は端的に1文
  - alternatives: 代替品 1〜3 個。ホーチミンで入手しやすい順。各 { name, reason }
  - nutrition_tags: 食材単位での栄養特徴 0〜3 個(プレーン日本語の短いラベル)`;

export interface RawDraft {
  title?: unknown;
  title_en?: unknown;
  description?: unknown;
  prep_time_min?: unknown;
  is_meal_prep_friendly?: unknown;
  meal_prep_days?: unknown;
  servings?: unknown;
  ingredients?: unknown;
  main_ingredient_tag?: unknown;
  country_tag?: unknown;
  nutrition_tags?: unknown;
  ingredient_info?: unknown;
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

function normalizeStringArray(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length === 0) continue;
    if (out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

const VALID_MAIN_TAGS: ReadonlySet<string> = new Set([
  "魚",
  "肉",
  "麺",
  "つまみ・副菜",
]);

function normalizeMainIngredient(raw: unknown): MainIngredientTag | null {
  return typeof raw === "string" && VALID_MAIN_TAGS.has(raw)
    ? (raw as MainIngredientTag)
    : null;
}

function normalizeCountryTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function normalizePairings(raw: unknown): IngredientPairing[] {
  if (!Array.isArray(raw)) return [];
  const out: IngredientPairing[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const food = asString(obj.food);
    if (!food) continue;
    const reason = asString(obj.reason) ?? "";
    out.push({ food, reason });
    if (out.length >= 5) break;
  }
  return out;
}

function normalizeAlternatives(raw: unknown): IngredientAlternative[] {
  if (!Array.isArray(raw)) return [];
  const out: IngredientAlternative[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const name = asString(obj.name);
    if (!name) continue;
    const reason = asString(obj.reason) ?? "";
    out.push({ name, reason });
    if (out.length >= 3) break;
  }
  return out;
}

function normalizeIngredientInfo(raw: unknown): IngredientInfoDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = asString(r.name);
  if (!name) return null;
  return {
    name,
    name_en: asString(r.name_en),
    name_vi: asString(r.name_vi),
    category: asString(r.category),
    origin: asString(r.origin),
    composition: asString(r.composition),
    taste_profile: asString(r.taste_profile),
    pairings: normalizePairings(r.pairings),
    alternatives: normalizeAlternatives(r.alternatives),
    nutrition_tags: normalizeStringArray(r.nutrition_tags, 5),
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
  const ingredient_info = Array.isArray(raw.ingredient_info)
    ? raw.ingredient_info
        .map(normalizeIngredientInfo)
        .filter((i): i is IngredientInfoDraft => i !== null)
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
    main_ingredient_tag: normalizeMainIngredient(raw.main_ingredient_tag),
    country_tag: normalizeCountryTag(raw.country_tag),
    nutrition_tags: normalizeStringArray(raw.nutrition_tags, 4),
    ingredient_info,
  };
}

export async function callClaudeJson(prompt: string): Promise<unknown> {
  const response = await anthropic.messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 8192,
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
