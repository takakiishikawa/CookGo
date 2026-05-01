import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 任意のレシピサイトの og:image を許可するため wildcard。
    // 個人ユース前提。次の3パターンを受ける:
    //   - Unsplash: images.unsplash.com
    //   - Supabase Storage: *.supabase.co
    //   - 外部レシピサイトの og:image: 任意の https ホスト
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // Vercel が WebP/AVIF を自動配信
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        // Service Worker must never be cached by browser
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
