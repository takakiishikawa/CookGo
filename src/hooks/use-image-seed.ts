"use client";

import { useCallback, useEffect, useState } from "react";

const PREFIX = "cookgo:image-seed:";

/**
 * ユーザーが「画像を変える」で選んだ seed を localStorage に保持する。
 * リロード後も同じ画像が出るようにする(キャッシュされた古い画像が戻ってくる体験を避ける)。
 *
 * @param key 食材ごとの一意キー(例: `staple:<id>` / `inventory:<id>`)
 * @returns [seed, regenerate, reset]
 */
export function useImageSeed(
  key: string | null,
): [number, () => void, () => void] {
  const [seed, setSeed] = useState(1);

  // マウント後に永続値を読み出して反映
  useEffect(() => {
    if (!key || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PREFIX + key);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) setSeed(n);
  }, [key]);

  const persist = useCallback(
    (next: number) => {
      if (!key || typeof window === "undefined") return;
      window.localStorage.setItem(PREFIX + key, String(next));
    },
    [key],
  );

  const regenerate = useCallback(() => {
    setSeed((s) => {
      const next = s + 1;
      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    if (key && typeof window !== "undefined") {
      window.localStorage.removeItem(PREFIX + key);
    }
    setSeed(1);
  }, [key]);

  return [seed, regenerate, reset];
}
