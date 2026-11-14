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

/** The main nav: a dark pill; the current section is violet and aria-current. */
export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={className}>
      <div className="flex gap-1 overflow-x-auto rounded-full bg-ink p-1.5 shadow-card">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 font-heading text-sm font-semibold whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-primary/60",
                current
                  ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)]"
                  : "text-ink-foreground/75 hover:bg-white/10 hover:text-ink-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
