"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@takaki/go-design-system";

/**
 * DS's UserMenu is coupled to the Sidebar component family (renders
 * SidebarMenuButton, needs SidebarProvider context). The new header has no
 * sidebar, so this composes DropdownMenu + Avatar directly instead.
 */
export function UserMenuButton() {
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

  const initials = (displayName || "U").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="アカウントメニュー"
          className="flex items-center justify-center w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity"
        >
          <Avatar className="w-8 h-8">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="rounded-2xl border-[oklch(88%_0.015_70)] bg-[oklch(98%_0.01_70)] p-1.5 min-w-56 shadow-lg"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2.5 pt-1.5 pb-2 font-normal">
          <span className="font-semibold text-[oklch(24%_0.02_50)] truncate">
            {displayName || "—"}
          </span>
          {email && (
            <span className="text-xs text-[oklch(55%_0.02_50)] truncate">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[oklch(90%_0.013_70)] mb-1" />
        <DropdownMenuItem
          onSelect={handleSignOut}
          className="rounded-lg px-2.5 py-2 gap-2.5 text-[13px] font-medium text-[oklch(24%_0.02_50)] focus:bg-[oklch(93%_0.015_70)] focus:text-[oklch(24%_0.02_50)]"
        >
          <LogOut className="w-4 h-4" />
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
