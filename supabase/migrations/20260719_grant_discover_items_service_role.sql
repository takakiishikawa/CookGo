-- cookgo.discover_items への権限付与。
-- 新規スキーマ/テーブルは既存テーブル (recipes 等) と違って権限が自動継承されず、
-- RLS ポリシーがあっても土台の GRANT が無いと "permission denied" になるため、
-- 明示的な GRANT が必要（20260718_add_discover_items.sql 適用時に漏れていた）。
-- Supabase ダッシュボード or CLI で適用してください（再実行しても安全な GRANT のみ）。

-- service_role: Discover feed の週次更新ジョブ (RLS バイパス) が書き込みに使う
GRANT USAGE ON SCHEMA cookgo TO service_role;
GRANT SELECT, INSERT, UPDATE ON cookgo.discover_items TO service_role;

-- authenticated / anon: アプリ側の読み取り (RLS ポリシーで SELECT のみ許可済み)
GRANT USAGE ON SCHEMA cookgo TO authenticated, anon;
GRANT SELECT ON cookgo.discover_items TO authenticated, anon;
