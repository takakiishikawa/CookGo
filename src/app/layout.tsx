import type { Metadata, Viewport } from "next";
import { Inter, Lora, Noto_Sans_JP } from "next/font/google";
import { DesignTokens, Toaster } from "@takaki/go-design-system";
import { Analytics } from "@vercel/analytics/react";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

// DesignTokens only accepts primaryColor/primaryColorHover; the warm cream
// surfaces below have no equivalent prop, so they're injected as a plain
// <style> tag rendered right after <DesignTokens/> — DOM order guarantees
// this cascade wins over DesignTokens' own injected token defaults,
// independent of how Next.js orders the compiled globals.css stylesheet.
const HOMECOOK_SURFACE_CSS = `:root{
  --color-surface-subtle: oklch(96% 0.013 70);
  --color-surface: #ffffff;
  --color-surface-elevated: oklch(98% 0.01 70);
  --color-background: oklch(97% 0.015 70);
  --color-text-primary: oklch(24% 0.02 50);
  --color-text-secondary: oklch(48% 0.02 50);
  --color-text-subtle: oklch(55% 0.02 50);
  --color-border-default: oklch(88% 0.015 70);
  --color-border-subtle: oklch(92% 0.012 70);
}`;

export const viewport: Viewport = {
  themeColor: "#b5502e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "HomeCook",
  description:
    "撮るだけ・選ぶだけで、タンパク質の水位が見えて、料理のレパートリーが増えていく。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HomeCook",
    startupImage: [{ url: "/icons/icon-512.png" }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    title: "HomeCook",
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
      className={`${inter.variable} ${lora.variable} ${notoSansJP.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <DesignTokens
          primaryColor="oklch(56% 0.15 35)"
          primaryColorHover="oklch(49% 0.14 35)"
        />
        <style dangerouslySetInnerHTML={{ __html: HOMECOOK_SURFACE_CSS }} />
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
