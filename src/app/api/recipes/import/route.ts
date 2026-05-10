import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  callClaudeJson,
  normalizeDraft,
  FIXED_CONSTRAINTS,
  SCHEMA_SAMPLE,
  type RawDraft,
} from "@/lib/recipes-ai";
import { extractFromHtml, fetchHtml } from "@/lib/html-extract";
import type { DraftRecipe } from "@/types/api";

export const maxDuration = 60;

interface ImportRequest {
  url?: string;
  content?: string;
}

export interface ImportSuccess {
  draft: DraftRecipe;
  source_url: string | null;
  thumbnail: string | null;
}

export interface ImportFetchFailure {
  error: "fetch_failed";
  message: string;
  source_url: string;
  reason?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as ImportRequest;
    const url = (body.url ?? "").trim();
    const content = (body.content ?? "").trim();

    if (!url && !content) {
      return NextResponse.json(
        { error: "url または content を指定してください" },
        { status: 400 },
      );
    }

    let extractedText = content;
    let sourceUrl: string | null = url || null;
    let thumbnail: string | null = null;

    if (url && !content) {
      const fetched = await fetchHtml(url);
      if (!fetched.ok || !fetched.html) {
        console.warn("import fetch_failed", { url, reason: fetched.reason });
        return NextResponse.json(
          {
            error: "fetch_failed",
            message:
              "サイトからの取得に失敗しました。レシピ本文をテキストで貼り付けてください。",
            source_url: url,
            reason: fetched.reason ?? undefined,
          } satisfies ImportFetchFailure,
          { status: 422 },
        );
      }
      const extracted = extractFromHtml(fetched.html);
      thumbnail = extracted.ogImage;

      if (extracted.jsonLdRecipe) {
        // JSON-LD があれば最優先で渡す（Claude にも JSON 整形を任せる）
        extractedText = `タイトル: ${extracted.title ?? ""}
JSON-LD Recipe(参考):
${JSON.stringify(extracted.jsonLdRecipe).slice(0, 8_000)}

本文(参考):
${extracted.bodyText}`;
      } else {
        extractedText = `タイトル: ${extracted.title ?? ""}
本文:
${extracted.bodyText}`;
      }

      if (!extractedText.trim()) {
        return NextResponse.json(
          {
            error: "fetch_failed",
            message:
              "サイトからレシピ情報を抽出できませんでした。本文を貼り付けてください。",
            source_url: url,
          } satisfies ImportFetchFailure,
          { status: 422 },
        );
      }
    }

    const prompt = `以下のレシピ情報から、JSON 形式の構造化レシピを生成してください。日本語で出力。

【入力】
${extractedText.slice(0, 12_000)}

${FIXED_CONSTRAINTS}

【追加ルール】
- 入力に書かれている人数(servings)があればそれを反映、なければ 1
- ingredients は具体名で、amount/unit はそのまま転記
- 元レシピに作り方手順が書かれていても、出力には含めない(調理手順は別途 YouTube/元レシピ URL から参照する設計のため)

最終回答は JSON のみで返してください(コードブロック・説明文不要):
${SCHEMA_SAMPLE}`;

    const parsed = (await callClaudeJson(prompt)) as RawDraft;
    const draft = normalizeDraft(parsed);
    if (!draft) {
      throw new Error("レシピを構造化できませんでした");
    }

    const enrichedDraft: DraftRecipe = {
      ...draft,
      source_url: sourceUrl,
      source_tag: "ai_suggest",
      // og:image が取れていれば save 時の Unsplash 取得をスキップさせる
      image_url: thumbnail ?? null,
    };

    return NextResponse.json({
      draft: enrichedDraft,
      source_url: sourceUrl,
      thumbnail,
    } satisfies ImportSuccess);
  } catch (error) {
    console.error("import error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `取り込みに失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
