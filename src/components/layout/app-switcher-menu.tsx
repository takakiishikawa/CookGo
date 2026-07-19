"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[oklch(92%_0.012_70)] transition-colors text-[oklch(45%_0.02_50)]"
        >
          <Grid2x2 className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="rounded-2xl border-[oklch(88%_0.015_70)] bg-[oklch(98%_0.01_70)] p-1.5 min-w-52 shadow-lg"
      >
        <DropdownMenuLabel className="px-2.5 pt-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[oklch(55%_0.02_50)]">
          Switch app
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[oklch(90%_0.013_70)] mb-1" />
        {GO_APPS.map((app) => {
          const Icon = app.icon;
          return (
            <DropdownMenuItem
              key={app.name}
              asChild
              className="rounded-lg px-2.5 py-2 gap-2.5 text-[13px] font-medium text-[oklch(24%_0.02_50)] focus:bg-[oklch(93%_0.015_70)] focus:text-[oklch(24%_0.02_50)]"
            >
              <a href={app.url}>
                {Icon && (
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-md shrink-0"
                    style={{ background: `${app.color}1a`, color: app.color }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
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
