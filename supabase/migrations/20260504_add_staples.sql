-- 定番（定期購入する食材・日用品）リスト。
-- スーパーで参照する用途。画像はクライアント側で /api/image によって自動取得するため
-- DB には URL を保存しない。並びは sort_order > created_at の順を意図する。
-- Supabase ダッシュボード or CLI で適用してください。

CREATE TABLE IF NOT EXISTS cookgo.staples (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  name_en     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS staples_user_id_idx ON cookgo.staples (user_id, sort_order, created_at);

ALTER TABLE cookgo.staples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staples_select_own" ON cookgo.staples;
DROP POLICY IF EXISTS "staples_insert_own" ON cookgo.staples;
DROP POLICY IF EXISTS "staples_update_own" ON cookgo.staples;
DROP POLICY IF EXISTS "staples_delete_own" ON cookgo.staples;

CREATE POLICY "staples_select_own" ON cookgo.staples
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "staples_insert_own" ON cookgo.staples
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "staples_update_own" ON cookgo.staples
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "staples_delete_own" ON cookgo.staples
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE cookgo.staples IS
  '定期的に購入する食材・日用品（鶏胸肉など）。スーパーで参照する用途のシンプルなリスト。';
