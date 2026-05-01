import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // gallery / 詳細で使う外部画像ドメインを許可
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
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
