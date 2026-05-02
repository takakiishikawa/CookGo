-- レシピの特徴タグ (例: ["BONIQ公式", "湯せん低温調理"])。
-- 推薦カードでの features と同等の文字列配列。
-- Supabase ダッシュボード or CLI で適用してください。
ALTER TABLE cookgo.recipes
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN cookgo.recipes.tags IS
  '短い特徴タグの配列。推薦カードや詳細画面で表示。';
