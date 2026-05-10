-- =====================================================================
-- レシピモーダル化リファクタに伴う DB 変更
--   - レシピ: 構造化タグ追加 (scene / genre_tags / nutrition_tags)
--   - レシピ: 旧 tags 列 / steps 列を削除（モーダルでは表示しないため）
--   - 在庫テーブル新設 (inventory_items)
--   - 食材情報テーブル新設 (ingredient_info: グローバル共有キャッシュ)
-- 適用前に本番データをバックアップしてから実行してください。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. recipes テーブル: 構造化タグ追加
-- ---------------------------------------------------------------------
ALTER TABLE cookgo.recipes
  ADD COLUMN IF NOT EXISTS scene          TEXT,
  ADD COLUMN IF NOT EXISTS genre_tags     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS nutrition_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- scene は必須だが既存行のため一旦 NULL 許容で追加 → AI で埋め直してから NOT NULL 化を推奨
ALTER TABLE cookgo.recipes
  DROP CONSTRAINT IF EXISTS recipes_scene_check;
ALTER TABLE cookgo.recipes
  ADD CONSTRAINT recipes_scene_check
    CHECK (scene IS NULL OR scene IN ('meal', 'snack'));

COMMENT ON COLUMN cookgo.recipes.scene IS
  'シーン分類: meal=ごはん（昼夜の主食）, snack=軽食（つまみ・小腹埋め）';
COMMENT ON COLUMN cookgo.recipes.genre_tags IS
  'ジャンルタグ（複数可）: 和食 / 中華 / 多国籍 / 夜食 など';
COMMENT ON COLUMN cookgo.recipes.nutrition_tags IS
  '栄養プロファイル（2〜3個）: 高タンパク / 炭水化物中心 / ビタミンB豊富 など';

-- フィルタ用 GIN インデックス
CREATE INDEX IF NOT EXISTS recipes_genre_tags_gin_idx
  ON cookgo.recipes USING GIN (genre_tags);
CREATE INDEX IF NOT EXISTS recipes_nutrition_tags_gin_idx
  ON cookgo.recipes USING GIN (nutrition_tags);
CREATE INDEX IF NOT EXISTS recipes_scene_idx
  ON cookgo.recipes (scene);

-- ---------------------------------------------------------------------
-- 2. recipes テーブル: 旧カラム削除
--   - tags: 旧汎用タグ（"BONIQ公式" 等）。新 genre/nutrition に置き換え
--   - steps: 作り方ステップ機能の全面削除
-- ---------------------------------------------------------------------
ALTER TABLE cookgo.recipes DROP COLUMN IF EXISTS tags;
ALTER TABLE cookgo.recipes DROP COLUMN IF EXISTS steps;

-- 補足: prep_time_min / is_meal_prep_friendly / meal_prep_days は
-- モーダルで非表示だが、AI 生成の文脈情報として残す（無理に削らない）

-- ---------------------------------------------------------------------
-- 3. inventory_items: 在庫テーブル
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cookgo.inventory_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  name_en     TEXT,
  name_vi     TEXT,
  category    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS inventory_items_user_id_idx
  ON cookgo.inventory_items (user_id, sort_order, created_at);

ALTER TABLE cookgo.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_items_select_own" ON cookgo.inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert_own" ON cookgo.inventory_items;
DROP POLICY IF EXISTS "inventory_items_update_own" ON cookgo.inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete_own" ON cookgo.inventory_items;

CREATE POLICY "inventory_items_select_own" ON cookgo.inventory_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "inventory_items_insert_own" ON cookgo.inventory_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inventory_items_update_own" ON cookgo.inventory_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inventory_items_delete_own" ON cookgo.inventory_items
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE cookgo.inventory_items IS
  '家に常備していて変動が遅い食材（調味料・水・砂糖など）。買い物リストでは初期チェック済みで表示する。';

-- ---------------------------------------------------------------------
-- 4. ingredient_info: 食材情報グローバル共有テーブル
--   食材ポップアップ用。レシピ生成時に AI が同時生成しキャッシュ。
--   全認証ユーザーが SELECT 可、書き込みは service_role からのみ。
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cookgo.ingredient_info (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,                       -- 正規化済み日本語名（小文字化・trim 済み）
  name_en         TEXT,
  name_vi         TEXT,
  category        TEXT,                                       -- タンパク源 / 野菜 / 調味料 / 炭水化物 / その他
  origin          TEXT,                                       -- 名前の由来（短文）
  composition     TEXT,                                       -- 原料・加工プロセス（素人向け解説）
  taste_profile   TEXT,                                       -- 味覚プロファイル（感じる味 + 理由）
  pairings        JSONB NOT NULL DEFAULT '[]'::JSONB,         -- [{ food: string, reason: string }]
  alternatives    JSONB NOT NULL DEFAULT '[]'::JSONB,         -- [{ name: string, reason: string }] (max 3)
  nutrition_tags  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingredient_info_name_lower_idx
  ON cookgo.ingredient_info (LOWER(name));

ALTER TABLE cookgo.ingredient_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingredient_info_select_authenticated" ON cookgo.ingredient_info;

-- 認証ユーザー全員が read 可（料理愛好家コミュニティでデータ共有する設計）
CREATE POLICY "ingredient_info_select_authenticated" ON cookgo.ingredient_info
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE は service_role からのみ（RLS バイパス）。
-- authenticated 向けの write policy は作らない。

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION cookgo.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ingredient_info_set_updated_at ON cookgo.ingredient_info;
CREATE TRIGGER ingredient_info_set_updated_at
  BEFORE UPDATE ON cookgo.ingredient_info
  FOR EACH ROW EXECUTE FUNCTION cookgo.set_updated_at();

COMMENT ON TABLE cookgo.ingredient_info IS
  '食材辞典（グローバル共有キャッシュ）。レシピ生成時に AI が同時生成しユーザー間で再利用。';
