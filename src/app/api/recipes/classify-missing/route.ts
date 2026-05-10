/**
 * 既存レシピのうち main_ingredient_tag / country_tag が未設定のものを
 * AI で一括分類してアップデートする補助エンドポイント。
 *
 * - 自分のレシピのみ対象 (RLS)
 * - 1回の呼び出しで最大 BATCH 件
 * - 完了したレシピ数 / 残り件数を返す
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_HAIKU, DB_SCHEMA } from "@/lib/constants";
import type { MainIngredientTag, RecipeIngredient } from "@/types/database";

export const maxDuration = 60;

const BATCH = 20;
const VALID_MAIN: ReadonlySet<string> = new Set([
  "魚",
  "鳥",
  "豚",
  "牛",
  "麺",
  "つまみ・副菜",
]);

const client = new Anthropic({ maxRetries: 0 });

interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  ingredients: RecipeIngredient[] | null;
  main_ingredient_tag: string | null;
  country_tag: string | null;
}

interface Classification {
  main_ingredient_tag: MainIngredientTag | null;
  country_tag: string | null;
}

async function classifyOne(r: RecipeRow): Promise<Classification | null> {
  const ingredients = (r.ingredients ?? [])
    .slice(0, 12)
    .map((i) => i.name)
    .filter(Boolean)
    .join(", ");
  const prompt = `以下の料理を分類してください。

【料理】
- タイトル: ${r.title}
- 説明: ${r.description ?? "(なし)"}
- 主要食材: ${ingredients || "(不明)"}

【出力ルール】
- main_ingredient_tag は次の 6 種から 1 つ:
  - "魚" : 魚介類が主役
  - "鳥" : 鶏肉・鴨肉など鳥類が主役
  - "豚" : 豚肉が主役
  - "牛" : 牛肉が主役
  - "麺" : 麺類が主役
  - "つまみ・副菜" : 上記に当てはまらない、または小皿/酒のあて
- country_tag は発祥国を日本語の国名のみで(絵文字・記号は付けない):
  - 例: "日本" / "中国" / "韓国" / "タイ" / "ベトナム" / "イタリア" / "フランス" / "メキシコ" / "インド" / "アメリカ"
  - 不明なら最も近い 1 国を選ぶ

- 出力する全テキストには絵文字・国旗記号を含めない(プレーン日本語のみ)

JSON のみ返答(コードブロック不要):
{ "main_ingredient_tag": "...", "country_tag": "..." }`;
  try {
    const res = await client.messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      main_ingredient_tag?: unknown;
      country_tag?: unknown;
    };
    const main =
      typeof parsed.main_ingredient_tag === "string" &&
      VALID_MAIN.has(parsed.main_ingredient_tag)
        ? (parsed.main_ingredient_tag as MainIngredientTag)
        : null;
    const country =
      typeof parsed.country_tag === "string" && parsed.country_tag.trim()
        ? parsed.country_tag.trim()
        : null;
    return { main_ingredient_tag: main, country_tag: country };
  } catch (e) {
    console.error("classify failed", { id: r.id, e });
    return null;
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: rows, error: selErr } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .select("id, title, description, ingredients, main_ingredient_tag, country_tag")
      .eq("user_id", user.id)
      .or("main_ingredient_tag.is.null,country_tag.is.null")
      .order("created_at", { ascending: false })
      .limit(BATCH);
    if (selErr) throw selErr;

    const targets = (rows ?? []) as RecipeRow[];
    let updated = 0;
    for (const r of targets) {
      const cls = await classifyOne(r);
      if (!cls) continue;
      const patch: Record<string, string | null> = {};
      if (!r.main_ingredient_tag && cls.main_ingredient_tag)
        patch.main_ingredient_tag = cls.main_ingredient_tag;
      if (!r.country_tag && cls.country_tag) patch.country_tag = cls.country_tag;
      if (Object.keys(patch).length === 0) continue;
      const { error: updErr } = await supabase
        .schema(DB_SCHEMA)
        .from("recipes")
        .update(patch)
        .eq("id", r.id)
        .eq("user_id", user.id);
      if (!updErr) updated++;
    }

    // 残りの件数を返す(別バッチで再叩き判定用)
    const { count } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .or("main_ingredient_tag.is.null,country_tag.is.null");

    return NextResponse.json({
      processed: targets.length,
      updated,
      remaining: count ?? 0,
    });
  } catch (error) {
    console.error("classify-missing error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `分類に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
