import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DB_SCHEMA } from "@/lib/constants";
import { MAIN_INGREDIENT_TAGS, type Recipe } from "@/types/database";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (error || !data)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ recipe: data as Recipe });
  } catch (error) {
    console.error("recipe GET error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `取得に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as {
      main_ingredient_tag?: unknown;
    };

    const update: { main_ingredient_tag?: string | null } = {};

    if ("main_ingredient_tag" in body) {
      const tag = body.main_ingredient_tag;
      if (
        tag !== null &&
        !(typeof tag === "string" && (MAIN_INGREDIENT_TAGS as readonly string[]).includes(tag))
      ) {
        return NextResponse.json(
          { error: "不正な主食材タグです" },
          { status: 400 },
        );
      }
      update.main_ingredient_tag = tag as string | null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "更新する項目がありません" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("recipe PATCH error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `更新に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("recipes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("recipe DELETE error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `削除に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
