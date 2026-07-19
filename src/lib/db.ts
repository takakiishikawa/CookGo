import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_SCHEMA } from "./constants";
import type {
  DiscoverItem,
  DiscoverTabId,
  InventoryItem,
  Recipe,
  Staple,
} from "@/types/database";

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
  staples: {
    getAll: async (
      supabase: SupabaseClient,
      userId: string,
    ): Promise<Staple[]> => {
      const { data } = await s(supabase)
        .from("staples")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as Staple[];
    },
    insert: async (
      supabase: SupabaseClient,
      values: { user_id: string; name: string; name_en?: string | null },
    ) => {
      return s(supabase).from("staples").insert(values).select().single();
    },
    update: async (
      supabase: SupabaseClient,
      id: string,
      values: Partial<Pick<Staple, "name" | "name_en" | "sort_order">>,
    ) => {
      return s(supabase)
        .from("staples")
        .update(values)
        .eq("id", id)
        .select()
        .single();
    },
    delete: async (supabase: SupabaseClient, id: string) => {
      return s(supabase).from("staples").delete().eq("id", id);
    },
  },
  inventory: {
    getAll: async (
      supabase: SupabaseClient,
      userId: string,
    ): Promise<InventoryItem[]> => {
      const { data } = await s(supabase)
        .from("inventory_items")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as InventoryItem[];
    },
  },
  discover: {
    getActive: async (supabase: SupabaseClient): Promise<DiscoverItem[]> => {
      const { data, error } = await s(supabase)
        .from("discover_items")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) console.error("db.discover.getActive error:", error);
      return (data ?? []) as DiscoverItem[];
    },
    getActiveByTab: async (
      supabase: SupabaseClient,
      tabId: DiscoverTabId,
    ): Promise<DiscoverItem[]> => {
      const { data } = await s(supabase)
        .from("discover_items")
        .select("*")
        .eq("is_active", true)
        .eq("tab_id", tabId)
        .order("created_at", { ascending: true });
      return (data ?? []) as DiscoverItem[];
    },
  },
};
