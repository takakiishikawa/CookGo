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
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="font-semibold truncate">{displayName || "—"}</span>
          {email && (
            <span className="text-xs text-muted-foreground truncate">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} className="gap-2">
          <LogOut className="w-4 h-4" />
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
