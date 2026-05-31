import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_SONNET } from "@/lib/constants";
import type { IngredientPairing } from "@/types/database";

export const maxDuration = 60;

const client = new Anthropic({ maxRetries: 0 });

const ALLOWED_MEDIA = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
type AllowedMedia = (typeof ALLOWED_MEDIA)[number];

interface IdentifyRequest {
  /** data: プレフィックスを除いた base64 文字列 */
  image: string;
  mediaType: string;
}

export interface IdentifyResult {
  /** 最も可能性が高い日本語名 */
  name: string;
  name_en: string | null;
  name_vi: string | null;
  category: string | null;
  /** どんな種類・品種・分類か */
  kind: string | null;
  /** それが何なのか・由来や背景 */
  origin: string | null;
  /** 味・香り・食感の特徴 */
  taste_profile: string | null;
  /** 相性のいい食材・料理 */
  pairings: IngredientPairing[];
  /** レシピを探すための日本語検索クエリ */
  recipe_query: string;
  /** 判別が難しい場合の補足。自信があれば null */
  confidence: string | null;
}

export interface IdentifyResponse {
  result: IdentifyResult;
}

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
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
    out.push({ food, reason: asString(obj.reason) ?? "" });
    if (out.length >= 4) break;
  }
  return out;
}

const PROMPT = `あなたはベトナム・ホーチミンのローカル市場やスーパーの食材・料理に精通した料理案内人です。アップロードされた写真に写っているもの（生の食材・調味料・加工品・調理済みの料理など何でも）を特定し、初めて見た人にも「ふーん、おもしろい!」と感じてもらえるように解説してください。

【解説のポイント】
- 写真の主役となる食材・料理を 1 つ特定する（複数写っていれば最も中心的なもの）
- 専門用語を避け、身近なたとえで分かりやすく
- 1 文は簡潔に。冗長な前置きや絵文字・装飾記号は使わない。プレーン日本語のみ
- 確実に断定できない場合は confidence に「〜の可能性が高いです」のように補足し、最も可能性の高い候補を name に入れる

【各フィールドの書き方】
- name: 日本語の名称（最も可能性が高いもの）
- name_en: 英語名（分かれば）
- name_vi: ベトナム語名（分かれば。なければ null）
- category: 次のいずれか → タンパク源 / 野菜 / 調味料 / 炭水化物 / その他
- kind: どんな種類・品種・分類か（1〜2 文）
- origin: それが何なのか・由来や背景・ベトナムでの位置づけ（1〜2 文）
- taste_profile: 味・香り・食感の特徴と、なぜそう感じるか（1〜2 文）
- pairings: 相性のいい食材や料理 1〜4 個。各 { food, reason } で reason は 1 文
- recipe_query: この食材・料理を使った/関連する家庭向けレシピを日本語サイトで探すための検索クエリ（例: "空芯菜 ニンニク炒め", "バインミー 自家製")
- confidence: 判別に自信があれば null、難しければ補足文

JSON のみで返答してください（コードブロック・前後の説明文は不要）:
{
  "name": "...",
  "name_en": "...",
  "name_vi": null,
  "category": "...",
  "kind": "...",
  "origin": "...",
  "taste_profile": "...",
  "pairings": [{ "food": "...", "reason": "..." }],
  "recipe_query": "...",
  "confidence": null
}`;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as IdentifyRequest;
    const image = (body.image ?? "").trim();
    const mediaType = (body.mediaType ?? "").trim();

    if (!image) {
      return NextResponse.json(
        { error: "画像が指定されていません" },
        { status: 400 },
      );
    }
    if (!ALLOWED_MEDIA.includes(mediaType as AllowedMedia)) {
      return NextResponse.json(
        { error: "対応していない画像形式です" },
        { status: 400 },
      );
    }

    const response = await client.messages.create({
      model: CLAUDE_SONNET,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as AllowedMedia,
                data: image,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("identify: no JSON in response", {
        text: text.slice(0, 500),
      });
      throw new Error("写真から食材を特定できませんでした");
    }

    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const name = asString(parsed.name);
    if (!name) {
      throw new Error("写真から食材を特定できませんでした");
    }

    const result: IdentifyResult = {
      name,
      name_en: asString(parsed.name_en),
      name_vi: asString(parsed.name_vi),
      category: asString(parsed.category),
      kind: asString(parsed.kind),
      origin: asString(parsed.origin),
      taste_profile: asString(parsed.taste_profile),
      pairings: normalizePairings(parsed.pairings),
      recipe_query: asString(parsed.recipe_query) ?? name,
      confidence: asString(parsed.confidence),
    };

    return NextResponse.json({ result } satisfies IdentifyResponse);
  } catch (error) {
    console.error("identify error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `写真の解析に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
