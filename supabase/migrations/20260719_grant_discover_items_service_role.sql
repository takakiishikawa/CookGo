-- service_role (Discover feed の週次更新ジョブが使う RLS バイパスクライアント) に
-- cookgo.discover_items への権限を付与する。
-- 新規スキーマ/テーブルは service_role であってもデフォルトでは権限が無いため、
-- 明示的な GRANT が必要（20260718_add_discover_items.sql 適用時に漏れていた）。
-- Supabase ダッシュボード or CLI で適用してください。

GRANT USAGE ON SCHEMA cookgo TO service_role;
GRANT SELECT, INSERT, UPDATE ON cookgo.discover_items TO service_role;
