"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  GO_APPS,
} from "@takaki/go-design-system";
import { Grid2x2 } from "lucide-react";

/**
 * DS's AppSwitcher is coupled to the Sidebar component family (renders
 * SidebarMenuButton, needs SidebarProvider context, sidebar-accent colors).
 * The new header has no sidebar, so this composes the same DropdownMenu
 * primitives + GO_APPS data directly instead of force-fitting AppSwitcher.
 */
export function AppSwitcherMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="アプリを切り替え"
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/5 transition-colors text-muted-foreground"
        >
          <Grid2x2 className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        {GO_APPS.map((app) => {
          const Icon = app.icon;
          return (
            <DropdownMenuItem key={app.name} asChild>
              <a href={app.url} className="gap-2">
                {Icon && (
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{ color: app.color }}
                  />
                )}
                <span className="flex-1">{app.name}</span>
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
