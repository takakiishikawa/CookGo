"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button, PageHeader, Section } from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { createClient } from "@/lib/supabase/client";

export function SettingsClient() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-5 pb-8 space-y-5 max-w-2xl">
        <PageHeader title="設定" />

        <Section title="アカウント">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
          >
            <LogOut className="w-3.5 h-3.5" />
            ログアウト
          </Button>
        </Section>
      </div>
    </div>
  );
}
