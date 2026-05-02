import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { DesignTokens, Toaster } from "@takaki/go-design-system";
import { Analytics } from "@vercel/analytics/react";
import { DarkModeInit } from "@/components/dark-mode-init";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#16A34A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "CookGo",
  description:
    "撮るだけ・選ぶだけで、タンパク質の水位が見えて、料理のレパートリーが増えていく。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CookGo",
    startupImage: [{ url: "/icons/icon-512.png" }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    title: "CookGo",
    description:
      "撮るだけ・選ぶだけで、タンパク質の水位が見えて、料理のレパートリーが増えていく。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJP.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <DarkModeInit />
        <DesignTokens primaryColor="#16A34A" primaryColorHover="#15803D" />
        <link
          rel="apple-touch-icon"
          sizes="192x192"
          href="/icons/icon-192.png"
        />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full">
        {children}
        <Toaster />
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
