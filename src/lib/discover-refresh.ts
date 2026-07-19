import { getISOWeek, getISOWeekYear } from "date-fns";
import { DB_SCHEMA } from "@/lib/constants";
import { searchRecipes } from "@/lib/recipe-recommend";
import { createServiceClient } from "@/lib/supabase/service";
import { DISCOVER_TAB_IDS, type DiscoverTabId } from "@/types/database";

const POOL_SIZE = 20;
const REPLACE_RATIO = 0.3;

const TAB_TOPICS: Record<DiscoverTabId, string> = {
  for_you:
    "様々な料理ジャンル・主菜から選んだ、作りやすく評判の良い夕食レシピ(幅広いバリエーション)",
  quick: "20分以内で作れる平日向けの時短レシピ",
  new_flavors:
    "普段あまり作らない国・地域の料理、意外な組み合わせのフュージョン料理",
  seasonal: `${new Date().getMonth() + 1}月の旬の食材を使った季節のレシピ`,
};

function currentWeekKey(): string {
  const now = new Date();
  return `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;
}

interface TabRefreshResult {
  tab_id: DiscoverTabId;
  retired: number;
  inserted: number;
  active_total: number;
}

async function refreshTab(tabId: DiscoverTabId): Promise<TabRefreshResult> {
  const supabase = createServiceClient();
  const table = supabase.schema(DB_SCHEMA).from("discover_items");

  const { data: active } = await table
    .select("id, source_url, created_at")
    .eq("tab_id", tabId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const activeRows = active ?? [];
  const replaceCount =
    activeRows.length < POOL_SIZE
      ? POOL_SIZE - activeRows.length
      : Math.round(POOL_SIZE * REPLACE_RATIO);

  if (replaceCount <= 0) {
    return {
      tab_id: tabId,
      retired: 0,
      inserted: 0,
      active_total: activeRows.length,
    };
  }

  const toRetire = activeRows.slice(0, replaceCount);
  if (toRetire.length > 0) {
    await table
      .update({ is_active: false })
      .in(
        "id",
        toRetire.map((r) => r.id),
      );
  }

  const stillActiveUrls = new Set(
    activeRows.slice(toRetire.length).map((r) => r.source_url as string),
  );

  const candidates = await searchRecipes(TAB_TOPICS[tabId], replaceCount);
  const seen = new Set<string>();
  const rows = candidates
    .filter((c) => {
      const key = c.url.toLowerCase();
      if (stillActiveUrls.has(c.url) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, replaceCount)
    .map((c) => ({
      tab_id: tabId,
      title: c.title,
      image_url: c.thumbnail,
      source_url: c.url,
      week_key: currentWeekKey(),
      is_active: true,
    }));

  let inserted = 0;
  if (rows.length > 0) {
    const { data, error } = await table
      .upsert(rows, {
        onConflict: "tab_id,source_url",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      console.warn("discover refresh insert failed:", tabId, error.message);
    } else {
      inserted = data?.length ?? 0;
    }
  }

  return {
    tab_id: tabId,
    retired: toRetire.length,
    inserted,
    active_total: activeRows.length - toRetire.length + inserted,
  };
}

export async function refreshDiscoverFeed(
  onlyTab?: DiscoverTabId,
): Promise<{ week_key: string; results: TabRefreshResult[] }> {
  const tabs = onlyTab ? [onlyTab] : DISCOVER_TAB_IDS;
  const results = await Promise.all(tabs.map((t) => refreshTab(t)));
  return { week_key: currentWeekKey(), results };
}
