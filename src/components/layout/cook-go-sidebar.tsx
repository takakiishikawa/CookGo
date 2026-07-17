"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BookOpen, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  AppSwitcher,
  GO_APPS,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@takaki/go-design-system";

const navItems = [
  { href: "/recipes", icon: BookOpen, label: "レシピ" },
];

function isActive(href: string, pathname: string) {
  return pathname.startsWith(href);
}

export function CookGoSidebar() {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        setDisplayName(
          user.user_metadata?.display_name ||
            user.email?.split("@")[0] ||
            "User",
        );
        setEmail(user.email || "");
        setAvatarUrl(user.user_metadata?.avatar_url || "");
      });
    });
  }, []);

  async function handleSignOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <Sidebar>
      {/* ヘッダー：アプリ切り替え */}
      <SidebarHeader>
        <AppSwitcher
          currentApp="CookGo"
          apps={GO_APPS}
          placement="bottom"
        />
      </SidebarHeader>

      {/* メインナビ */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, icon: Icon, label }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(href, pathname)}
                  >
                    <Link href={href}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* フッター：ユーザー情報 + ログアウト */}
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>{(displayName || "?").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col text-sm">
            <span className="truncate font-medium">{displayName || "—"}</span>
            {email && (
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            )}
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOut className="h-4 w-4 shrink-0" />
              ログアウト
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
