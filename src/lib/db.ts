import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_SCHEMA } from "./constants";
import type {
  Recipe,
  PantryItem,
  ShoppingListItem,
  MealPlan,
  MealPlanWithRecipe,
  FoodLog,
  FoodLogWithRecipe,
  MealType,
} from "@/types/database";

function s(supabase: SupabaseClient) {
  return supabase.schema(DB_SCHEMA);
}

export const db = {
  plans: {
    getWeek: async (
      supabase: SupabaseClient,
      userId: string,
      startDate: string,
      endDate: string,
    ): Promise<MealPlanWithRecipe[]> => {
      const { data } = await s(supabase)
        .from("meal_plans")
        .select("*, recipe:recipes(id, title, title_en, image_url)")
        .eq("user_id", userId)
        .gte("planned_date", startDate)
        .lte("planned_date", endDate)
        .order("planned_date")
        .order("meal_type");
      return (data ?? []) as unknown as MealPlanWithRecipe[];
    },

    getToday: async (
      supabase: SupabaseClient,
      userId: string,
      date: string,
    ): Promise<MealPlanWithRecipe[]> => {
      const { data } = await s(supabase)
        .from("meal_plans")
        .select("*, recipe:recipes(id, title, title_en, image_url)")
        .eq("user_id", userId)
        .eq("planned_date", date)
        .order("meal_type");
      return (data ?? []) as unknown as MealPlanWithRecipe[];
    },

    upsert: async (
      supabase: SupabaseClient,
      values: Array<Omit<MealPlan, "id" | "created_at">>,
    ) => {
      return s(supabase)
        .from("meal_plans")
        .upsert(values, { onConflict: "user_id,planned_date,meal_type" })
        .select();
    },

    delete: async (supabase: SupabaseClient, id: string) => {
      return s(supabase).from("meal_plans").delete().eq("id", id);
    },
  },

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
  },

  pantry: {
    getAll: async (
      supabase: SupabaseClient,
      userId: string,
    ): Promise<PantryItem[]> => {
      const { data } = await s(supabase)
        .from("pantry_items")
        .select("*")
        .eq("user_id", userId)
        .order("category")
        .order("name");
      return (data ?? []) as PantryItem[];
    },
    count: async (
      supabase: SupabaseClient,
      userId: string,
    ): Promise<number> => {
      const { count } = await s(supabase)
        .from("pantry_items")
        .select("name", { count: "exact", head: true })
        .eq("user_id", userId);
      return count ?? 0;
    },
    insert: async (
      supabase: SupabaseClient,
      values: Partial<PantryItem> & { user_id: string },
    ) => {
      return s(supabase).from("pantry_items").insert(values).select().single();
    },
    insertMany: async (
      supabase: SupabaseClient,
      values: Array<Partial<PantryItem> & { user_id: string }>,
    ) => {
      return s(supabase).from("pantry_items").insert(values);
    },
    update: async (
      supabase: SupabaseClient,
      id: string,
      values: Partial<PantryItem>,
    ) => {
      return s(supabase).from("pantry_items").update(values).eq("id", id);
    },
    delete: async (supabase: SupabaseClient, id: string) => {
      return s(supabase).from("pantry_items").delete().eq("id", id);
    },
    upsert: async (
      supabase: SupabaseClient,
      values: Partial<PantryItem> & { user_id: string; name: string },
    ) => {
      return s(supabase)
        .from("pantry_items")
        .upsert(values, { onConflict: "user_id,name" });
    },
  },

  shopping: {
    getAll: async (
      supabase: SupabaseClient,
      userId: string,
    ): Promise<ShoppingListItem[]> => {
      const { data } = await s(supabase)
        .from("shopping_list_items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return (data ?? []) as ShoppingListItem[];
    },
    insert: async (
      supabase: SupabaseClient,
      values: Partial<ShoppingListItem> & { user_id: string },
    ) => {
      return s(supabase)
        .from("shopping_list_items")
        .insert(values)
        .select()
        .single();
    },
    update: async (
      supabase: SupabaseClient,
      id: string,
      values: Partial<ShoppingListItem>,
    ) => {
      return s(supabase)
        .from("shopping_list_items")
        .update(values)
        .eq("id", id);
    },
    delete: async (supabase: SupabaseClient, id: string) => {
      return s(supabase).from("shopping_list_items").delete().eq("id", id);
    },
    deleteMany: async (supabase: SupabaseClient, ids: string[]) => {
      return s(supabase).from("shopping_list_items").delete().in("id", ids);
    },
  },

  recipes2: {
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

  foodLogs: {
    getByDate: async (
      supabase: SupabaseClient,
      userId: string,
      date: string,
    ): Promise<FoodLogWithRecipe[]> => {
      const { data } = await s(supabase)
        .from("food_logs")
        .select(
          "*, recipe:recipes(id, title, title_en, image_url, servings)",
        )
        .eq("user_id", userId)
        .eq("logged_date", date)
        .order("created_at");
      return (data ?? []) as unknown as FoodLogWithRecipe[];
    },

    getByDateRange: async (
      supabase: SupabaseClient,
      userId: string,
      startDate: string,
      endDate: string,
    ): Promise<FoodLogWithRecipe[]> => {
      const { data } = await s(supabase)
        .from("food_logs")
        .select(
          "*, recipe:recipes(id, title, title_en, image_url, servings)",
        )
        .eq("user_id", userId)
        .gte("logged_date", startDate)
        .lte("logged_date", endDate)
        .order("logged_date")
        .order("created_at");
      return (data ?? []) as unknown as FoodLogWithRecipe[];
    },

    getRecentByMealType: async (
      supabase: SupabaseClient,
      userId: string,
      mealType: MealType,
      limit: number,
    ): Promise<FoodLogWithRecipe[]> => {
      const { data } = await s(supabase)
        .from("food_logs")
        .select(
          "*, recipe:recipes(id, title, title_en, image_url, servings)",
        )
        .eq("user_id", userId)
        .eq("meal_type", mealType)
        .order("logged_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as unknown as FoodLogWithRecipe[];
    },

    insert: async (
      supabase: SupabaseClient,
      values: Omit<FoodLog, "id" | "created_at">,
    ) => {
      return s(supabase).from("food_logs").insert(values).select().single();
    },

    update: async (
      supabase: SupabaseClient,
      id: string,
      values: Partial<FoodLog>,
    ) => {
      return s(supabase).from("food_logs").update(values).eq("id", id);
    },

    delete: async (supabase: SupabaseClient, id: string) => {
      return s(supabase).from("food_logs").delete().eq("id", id);
    },
  },
};
