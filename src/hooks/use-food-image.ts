"use client";

import { useState, useEffect } from "react";

interface UseFoodImageResult {
  imageUrl: string | null;
  loading: boolean;
  error: boolean;
}

interface UseFoodImageOptions {
  /** "supermarket" でパッケージ商品寄りの画像を優先 */
  context?: "supermarket";
  /** protein/vegetable/carb/seasoning/other。取得失敗時のフォールバック用 */
  category?: string | null;
  /** もう一方の言語の名前(任意)。日英両方を試して取りこぼしを減らす */
  queryAlt?: string | null;
}

export function useFoodImage(
  query: string | null,
  seed = 1,
  options: UseFoodImageOptions = {},
): UseFoodImageResult {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState(false);

  const { context, category, queryAlt } = options;

  useEffect(() => {
    if (!query) {
      setImageUrl(null);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    setImageUrl(null);
    const params = new URLSearchParams({ query });
    if (seed > 1) params.set("seed", String(seed));
    if (context) params.set("context", context);
    if (category) params.set("category", category);
    if (queryAlt && queryAlt !== query) params.set("queryAlt", queryAlt);
    fetch(`/api/image?${params.toString()}`)
      .then((r) => r.json())
      .then((d: { imageUrl: string | null }) => {
        if (!cancelled) {
          setImageUrl(d.imageUrl ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, seed, context, category, queryAlt]);

  return { imageUrl, loading, error };
}
