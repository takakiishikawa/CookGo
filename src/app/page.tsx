"use client";

import { useState } from "react";
import { ChefHatIcon } from "@/components/brand/chef-hat-icon";
import { GoogleIcon } from "@/components/brand/google-icon";
import { createClient } from "@/lib/supabase/client";

export default function LoginRoute() {
  const [pending, setPending] = useState(false);

  const handleGoogleSignIn = async () => {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://home-cook-lovat.vercel.app").replace(/\/$/, "")}/auth/callback`,
        scopes: "email profile",
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(97%_0.015_70)] p-4">
      <div className="w-full max-w-[380px] bg-white rounded-[24px] px-8 pt-10 pb-8 shadow-[0_20px_50px_rgba(80,40,20,0.08)]">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[oklch(93%_0.015_70)]">
            <ChefHatIcon size={32} className="text-[oklch(56%_0.15_35)]" />
          </div>
          <div className="text-center">
            <h1 className="font-serif font-bold text-2xl text-[oklch(24%_0.02_50)]">
              HomeCook
            </h1>
            <p className="text-sm text-[oklch(48%_0.02_50)] mt-1.5 leading-relaxed">
              Your recipes, organized and ready to cook.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={pending}
          aria-busy={pending}
          className="w-full flex items-center justify-center gap-3 bg-white border border-[oklch(85%_0.015_70)] rounded-full py-3 font-semibold text-[14px] text-[oklch(24%_0.02_50)] hover:bg-[oklch(97%_0.013_70)] transition-colors disabled:opacity-60"
        >
          {pending ? (
            <span className="w-5 h-5 rounded-full border-2 border-[oklch(56%_0.15_35)] border-t-transparent animate-spin" />
          ) : (
            <GoogleIcon className="w-5 h-5 shrink-0" />
          )}
          {pending ? "Signing in…" : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
