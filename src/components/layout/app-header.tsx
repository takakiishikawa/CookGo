import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  SidebarTrigger,
} from "@takaki/go-design-system";

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

interface AppHeaderProps {
  backHref?: string;
  breadcrumbs?: BreadcrumbCrumb[];
}

export function AppHeader({ backHref, breadcrumbs }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 h-12 px-3 bg-background border-b border-border shrink-0">
      <SidebarTrigger className="-ml-1 shrink-0" />
      {backHref && (
        <Link
          href={backHref}
          className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="min-w-0">
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={i} className="contents">
                  <BreadcrumbItem className={i === 0 ? "" : "hidden md:flex"}>
                    {isLast || !crumb.href ? (
                      <BreadcrumbPage className="truncate max-w-[180px] sm:max-w-[260px] md:max-w-none">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && (
                    <BreadcrumbSeparator className="hidden md:block" />
                  )}
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
    </header>
  );
}
