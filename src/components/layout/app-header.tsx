import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserMenuButton } from "@/components/layout/user-menu-button";

interface AppHeaderProps {
  backHref?: string;
  title?: string;
}

export function AppHeader({ backHref, title }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 h-12 px-3 bg-background border-b border-border shrink-0">
      {backHref && (
        <Link
          href={backHref}
          className="p-1.5 -ml-1 rounded-md hover:bg-muted transition-colors shrink-0"
          aria-label="戻る"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
      )}
      {title && (
        <span className="font-serif font-semibold text-base text-foreground truncate">
          {title}
        </span>
      )}
      <div className="flex-1" />
      <UserMenuButton />
    </header>
  );
}
