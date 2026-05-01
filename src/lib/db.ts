import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_SCHEMA } from "./constants";
import type { Recipe } from "@/types/database";

function s(supabase: SupabaseClient) {
  return supabase.schema(DB_SCHEMA);
}

export const db = {
  recipes: {
    getAll: async (
      supabase: SupabaseClient,
      userId: string,
      limit?: number,
    ): Promise<Recipe[]> => {
      let q = s(supabase)
        .from("recipes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data } = await q;
      return (data ?? []) as Recipe[];
    },
    getById: async (
      supabase: SupabaseClient,
      userId: string,
      id: string,
    ): Promise<Recipe | null> => {
      const { data } = await s(supabase)
        .from("recipes")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      return data as Recipe | null;
    },
    update: async (
      supabase: SupabaseClient,
      id: string,
      values: Partial<Recipe>,
    ) => {
      return s(supabase)
        .from("recipes")
        .update(values)
        .eq("id", id)
        .select()
        .single();
    },
    insert: async (
      supabase: SupabaseClient,
      values: Partial<Recipe> & { user_id: string; title: string },
    ) => {
      return s(supabase).from("recipes").insert(values).select().single();
    },
    delete: async (supabase: SupabaseClient, id: string) => {
      return s(supabase).from("recipes").delete().eq("id", id);
    },
  },
};
