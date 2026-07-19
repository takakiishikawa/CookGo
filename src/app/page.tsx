"use client";

import { LoginPage } from "@takaki/go-design-system";
import { ChefHatIcon } from "@/components/brand/chef-hat-icon";
import { createClient } from "@/lib/supabase/client";

export default function LoginRoute() {
  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://cook-go-lovat.vercel.app").replace(/\/$/, "")}/auth/callback`,
        scopes: "email profile",
      },
    });
  };

  return (
    <LoginPage
      productName="HomeCook"
      productLogo={<ChefHatIcon size={28} className="text-primary" />}
      tagline="料理を楽しむためのレシピ管理アプリ。"
      onGoogleSignIn={handleGoogleSignIn}
    />
  );
}
