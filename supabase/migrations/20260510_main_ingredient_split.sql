-- =====================================================================
-- 主食材タグの細分化: 「肉」を「鳥 / 豚 / 牛」に分割
--
-- - check 制約を再構成して 6 値(魚 / 鳥 / 豚 / 牛 / 麺 / つまみ・副菜)を許可
-- - 既存「肉」レコードは null に戻し、/api/recipes/classify-missing で AI 再分類させる
-- =====================================================================

-- 既存「肉」を NULL にして再分類対象にする
UPDATE cookgo.recipes
   SET main_ingredient_tag = NULL
 WHERE main_ingredient_tag = '肉';

-- check 制約を更新(6 値許可)
ALTER TABLE cookgo.recipes
  DROP CONSTRAINT IF EXISTS recipes_main_ingredient_tag_check;
ALTER TABLE cookgo.recipes
  ADD CONSTRAINT recipes_main_ingredient_tag_check
    CHECK (
      main_ingredient_tag IS NULL
      OR main_ingredient_tag IN ('魚', '鳥', '豚', '牛', '麺', 'つまみ・副菜')
    );

COMMENT ON COLUMN cookgo.recipes.main_ingredient_tag IS
  '主食材タグ。"魚" / "鳥" / "豚" / "牛" / "麺" / "つまみ・副菜" のいずれか。トップフィルタで使用';
