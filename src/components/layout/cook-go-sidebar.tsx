"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Settings,
  Leaf,
  ChevronsUpDown,
  Check,
  Sun,
  Moon,
  FileText,
  Dumbbell,
  Scale,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  UserMenu,
} from "@takaki/go-design-system";

const GO_APPS = [
  {
    name: "NativeGo",
    url: "https://english-learning-app-black.vercel.app/",
    color: "#0052CC",
  },
  {
    name: "KenyakuGo",
    url: "https://kenyaku-go.vercel.app/",
    color: "#F5A623",
  },
  { name: "TaskGo", url: "https://taskgo-dun.vercel.app/", color: "#5E6AD2" },
  {
    name: "CookGo",
    url: "https://cook-go-lovat.vercel.app/dashboard",
    color: "#16A34A",
  },
] as const;

const navItems = [
  { href: "/recipes", icon: BookOpen, label: "レシピ" },
];

const miniMenuItems = [
  { href: "/training", icon: Dumbbell, label: "トレーニング" },
  { href: "/body", icon: Scale, label: "ボディ" },
];

function isActive(href: string, pathname: string) {
  return pathname.startsWith(href);
}

export function CookGoSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
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
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  async function handleSignOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <Sidebar>
      {/* ヘッダー：ロゴ + アプリ切り替え */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex items-center justify-center rounded-md bg-primary p-1.5 shrink-0">
                    <Leaf className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none min-w-0">
                    <span className="text-xs text-muted-foreground">App</span>
                    <span className="text-sm font-medium tracking-tight truncate">
                      CookGo
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Goシリーズ
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {GO_APPS.map((app) => (
                  <DropdownMenuItem
                    key={app.name}
                    onSelect={() => {
                      window.location.href = app.url;
                    }}
                    className="gap-2"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: app.color }}
                      aria-hidden
                    />
                    <span className="flex-1">{app.name}</span>
                    {app.name === "CookGo" && (
                      <Check className="h-4 w-4 shrink-0 opacity-70" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
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

        {/* minimenu（PhysicalGoから引き継いだボディ管理） */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {miniMenuItems.map(({ href, icon: Icon, label }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    isActive={isActive(href, pathname)}
                  >
                    <Link href={href}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs">{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* フッター */}
      <SidebarFooter>
        <UserMenu
          displayName={displayName || "—"}
          email={email}
          avatarUrl={avatarUrl}
          items={[
            {
              title: "コンセプト",
              icon: FileText,
              onSelect: () => router.push("/concept"),
              isActive: pathname.startsWith("/concept"),
            },
            {
              title: "設定",
              icon: Settings,
              onSelect: () => router.push("/settings"),
              isActive: pathname.startsWith("/settings"),
            },
            {
              title: isDark ? "ダーク" : "ライト",
              icon: isDark ? Moon : Sun,
              onSelect: toggleTheme,
            },
          ]}
          signOut={{ onSelect: handleSignOut }}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
