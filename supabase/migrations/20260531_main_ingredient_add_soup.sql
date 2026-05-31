-- =====================================================================
-- 主食材タグに「スープ」を追加
--
-- - check 制約を再構成して 7 値(魚 / 鳥 / 豚 / 牛 / 麺 / スープ / つまみ・副菜)を許可
-- - 汁物・スープ料理を分類できるようにする(汁麺は引き続き「麺」)
-- =====================================================================

ALTER TABLE cookgo.recipes
  DROP CONSTRAINT IF EXISTS recipes_main_ingredient_tag_check;
ALTER TABLE cookgo.recipes
  ADD CONSTRAINT recipes_main_ingredient_tag_check
    CHECK (
      main_ingredient_tag IS NULL
      OR main_ingredient_tag IN ('魚', '鳥', '豚', '牛', '麺', 'スープ', 'つまみ・副菜')
    );

COMMENT ON COLUMN cookgo.recipes.main_ingredient_tag IS
  '主食材タグ。"魚" / "鳥" / "豚" / "牛" / "麺" / "スープ" / "つまみ・副菜" のいずれか。トップフィルタで使用';
