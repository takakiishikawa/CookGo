/**
 * POST /api/ingredients/generate
 *   食材辞典に未登録の食材を Claude Sonnet で生成し、ingredient_info テーブルへ upsert。
 *   既存があればそれを返却(=AI を呼ばない)。
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_SONNET, DB_SCHEMA } from "@/lib/constants";
import type {
  IngredientInfo,
  IngredientPairing,
  IngredientAlternative,
} from "@/types/database";

export const maxDuration = 60;

const client = new Anthropic({ maxRetries: 0 });

interface Body {
  name: string;
  name_en?: string | null;
  name_vi?: string | null;
  category?: string | null;
  /** true で既存があっても AI で再生成する(リフレッシュ用) */
  force?: boolean;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as Body;
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "name は必須です" },
        { status: 400 },
      );
    }

    if (!body.force) {
      const existing = await supabase
        .schema(DB_SCHEMA)
        .from("ingredient_info")
        .select("*")
        .eq("name", name)
        .maybeSingle();
      if (existing.data) {
        return NextResponse.json({ info: existing.data as IngredientInfo });
      }
    }

    const prompt = `あなたは料理オタクで、食材の魅力を熱く語る案内人です。専門用語を避け、たとえ話や身近な比喩を使い、誰でも「ふーん!おもしろい!」と感じる解説を書いてください。

【対象食材】
- 名前(日本語): ${name}
- 英語名: ${body.name_en ?? "(不明)"}
- カテゴリ: ${body.category ?? "(不明)"}

【出力ルール】
- origin: 名前の由来や歴史的トリビア (1〜2 文)。語源、伝来のエピソード、思わず「へぇ〜」と言いたくなる小話。
- composition: 何でできているか・どう作られているか (2〜3 文)。専門用語(例:「糊化」「変性」)を避け、身近な比喩で書く。
- taste_profile: 感じる味と、なぜそう感じるかの仕組み (1〜2 文)。舌のどこで何を感じる、口の中でどう広がる、を書くと臨場感が出る。
- pairings: 相性のいい食材 1〜3 個。各 { food, reason } で、reason は化学的・食感的になぜ合うかを 1 文で。
- alternatives: 代替品 1〜3 個。ホーチミンの市場やスーパーで手に入りやすい順。各 { name, reason }。
- nutrition_tags: 食材単位の栄養特徴 0〜3 個。プレーン日本語の短いラベル(絵文字は使わない)。

口調:
- 親しみのある語り口 OK。固い学術調にしない。「〜なんですよ」「〜してくれる存在」のような表現は OK。
- ただし 1 文は簡潔に。冗長な前置きは入れない。
- 絵文字・装飾記号は使わない。プレーン日本語のみ。

JSON のみで返答してください(コードブロック・説明文不要):
{
  "origin": "...",
  "composition": "...",
  "taste_profile": "...",
  "pairings": [{ "food": "...", "reason": "..." }],
  "alternatives": [{ "name": "...", "reason": "..." }],
  "nutrition_tags": ["..."]
}`;

    const res = await client.messages.create({
      model: CLAUDE_SONNET,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Claudeの応答からJSONを抽出できませんでした");
    }
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

    const row = {
      name,
      name_en: body.name_en ?? null,
      name_vi: body.name_vi ?? null,
      category: body.category ?? null,
      origin: asString(parsed.origin),
      composition: asString(parsed.composition),
      taste_profile: asString(parsed.taste_profile),
      pairings: normalizePairings(parsed.pairings),
      alternatives: normalizeAlternatives(parsed.alternatives),
      nutrition_tags: normalizeStringArray(parsed.nutrition_tags, 5),
    };

    const upsert = await supabase
      .schema(DB_SCHEMA)
      .from("ingredient_info")
      .upsert(row, { onConflict: "name", ignoreDuplicates: false })
      .select()
      .single();

    if (upsert.error) {
      console.error("ingredient_info upsert failed:", upsert.error);
      return NextResponse.json(
        { error: `保存に失敗しました: ${upsert.error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ info: upsert.data as IngredientInfo });
  } catch (error) {
    console.error("ingredients/generate error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `生成に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
