"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, ListChecks, Grid3x3 } from "lucide-react";
import { cn } from "cn";

const NAV_LINKS = [
  { href: "/plans", label: "Plans", icon: FileText },
  { href: "/findings", label: "Findings", icon: ListChecks },
  { href: "/ccc", label: "CCC matrix", icon: Grid3x3 },
] as const;

/** The main nav; the current section is highlighted and marked aria-current. */
export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1">
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              current
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
