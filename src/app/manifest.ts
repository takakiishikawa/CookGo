import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeCook",
    short_name: "HomeCook",
    description: "料理を楽しむためのレシピ管理アプリ",
    start_url: "/recipes",
    id: "/recipes",
    display: "standalone",
    background_color: "#fdf9f4",
    theme_color: "#b5502e",
    orientation: "portrait",
    categories: ["food", "health", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
