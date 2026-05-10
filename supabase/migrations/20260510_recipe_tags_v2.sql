-- =====================================================================
-- レシピタグ体系の再構成 (v2)
--   旧: scene (meal/snack) + genre_tags[] (和食/中華/夜食/多国籍)
--   新: main_ingredient_tag (魚/肉/麺/つまみ・副菜) + country_tag (🇯🇵日本 等)
--
-- 旧データは値ごと破棄します。マイグレーション後、AI 分類 API
-- (POST /api/recipes/classify-missing) を叩いて埋めてください。
-- =====================================================================

ALTER TABLE cookgo.recipes DROP COLUMN IF EXISTS scene;
ALTER TABLE cookgo.recipes DROP COLUMN IF EXISTS genre_tags;
DROP INDEX IF EXISTS cookgo.recipes_scene_idx;
DROP INDEX IF EXISTS cookgo.recipes_genre_tags_gin_idx;

ALTER TABLE cookgo.recipes
  ADD COLUMN IF NOT EXISTS main_ingredient_tag TEXT,
  ADD COLUMN IF NOT EXISTS country_tag TEXT;

ALTER TABLE cookgo.recipes
  DROP CONSTRAINT IF EXISTS recipes_main_ingredient_tag_check;
ALTER TABLE cookgo.recipes
  ADD CONSTRAINT recipes_main_ingredient_tag_check
    CHECK (
      main_ingredient_tag IS NULL
      OR main_ingredient_tag IN ('魚', '肉', '麺', 'つまみ・副菜')
    );

COMMENT ON COLUMN cookgo.recipes.main_ingredient_tag IS
  '主食材タグ。"魚" / "肉" / "麺" / "つまみ・副菜" のいずれか。トップフィルタで使用';
COMMENT ON COLUMN cookgo.recipes.country_tag IS
  '発祥国タグ。絵文字+国名 (例: "🇯🇵日本", "🇨🇳中国")。表示専用';

CREATE INDEX IF NOT EXISTS recipes_main_ingredient_tag_idx
  ON cookgo.recipes (main_ingredient_tag);
