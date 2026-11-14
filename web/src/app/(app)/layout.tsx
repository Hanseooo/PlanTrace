import Link from "next/link";
import { FlaskConical, Route } from "lucide-react";
import { HowItWorks } from "@/components/how-it-works";
import { MainNav } from "@/components/main-nav";

/** The app shell: logo, the dark pill nav, the synthetic-data label and help. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.45_0.2_300)] text-primary-foreground shadow-[0_8px_20px_-8px_var(--primary)]">
              <Route aria-hidden className="size-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-heading text-lg font-extrabold tracking-tight">
                PlanTrace
              </span>
              <span className="text-xs text-muted-foreground">
                City of Sampaguita
              </span>
            </span>
          </Link>
          <MainNav className="order-last w-full md:order-none md:mx-auto md:w-auto" />
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-3 py-1.5 text-sm font-bold text-warning">
              <FlaskConical aria-hidden className="size-4" />
              Synthetic demo data
            </p>
            <HowItWorks />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </>
  );
}
