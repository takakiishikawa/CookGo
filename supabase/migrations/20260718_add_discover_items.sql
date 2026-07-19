-- Discover タブ（For You / Quick / New Flavors / Seasonal）に表示する
-- AI web-search 由来のダッシュプール。週次で /api/discover/refresh
-- （Vercel Cron, service-role client）が全体の約 30% を入れ替える。
-- 一般ユーザーからの書き込みは不可、読み取りのみ許可。
-- Supabase ダッシュボード or CLI で適用してください。

CREATE TABLE IF NOT EXISTS cookgo.discover_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id      TEXT NOT NULL CHECK (tab_id IN ('for_you','quick','new_flavors','seasonal')),
  title       TEXT NOT NULL,
  image_url   TEXT,
  source_url  TEXT NOT NULL,
  week_key    TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS discover_items_tab_active_idx
  ON cookgo.discover_items (tab_id, is_active, created_at);

-- 同じ URL が同じタブに重複登録されないようにする（過去に retire 済みでも再登録不可、
-- 意図的な仕様。Supabase upsert の ON CONFLICT は部分インデックスを解決できないため
-- 通常のユニーク制約にする）
CREATE UNIQUE INDEX IF NOT EXISTS discover_items_tab_source_url_uidx
  ON cookgo.discover_items (tab_id, source_url);

ALTER TABLE cookgo.discover_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discover_items_select_authenticated" ON cookgo.discover_items;

CREATE POLICY "discover_items_select_authenticated" ON cookgo.discover_items
  FOR SELECT TO authenticated USING (true);

-- authenticated / anon 向けの INSERT/UPDATE/DELETE ポリシーは意図的に無し。
-- 書き込みは /api/discover/refresh の service-role クライアントのみ（RLS バイパス）。

COMMENT ON TABLE cookgo.discover_items IS
  'Discover タブの週次ローテーション AI キュレーションダッシュプール。/api/discover/refresh のみが書き込み、アプリユーザーには読み取り専用。';
