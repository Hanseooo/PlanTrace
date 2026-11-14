import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  FlaskConical,
  House,
  Landmark,
  Map as MapIcon,
  MousePointer2,
  Route,
  Siren,
  Sparkles,
} from "lucide-react";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "PlanTrace · Plans that connect",
  description:
    "PlanTrace reads a city's plans side by side and flags duplicate, orphan and conflicting projects before money is spent.",
};

const NAV = [
  { href: "/", label: "Home", current: true },
  { href: "/plans", label: "Plans" },
  { href: "/findings", label: "Findings" },
  { href: "/ccc", label: "CCC matrix" },
] as const;

// The fan of plan cards under the headline. Text colours are picked per card so
// every label clears 4.5:1 on its own gradient.
const SIDE_CARDS = [
  {
    type: "CLUP",
    name: "Land use",
    line: "Barangay 9 · high flood risk",
    icon: MapIcon,
    className:
      "from-[oklch(0.62_0.2_290)] to-[oklch(0.45_0.22_285)] text-white -rotate-[14deg] translate-y-14",
    pos: "left-[2%] hidden lg:flex",
  },
  {
    type: "CDP",
    name: "Development",
    line: "Housing · ₱25M · 2027",
    icon: House,
    className:
      "from-[oklch(0.78_0.14_15)] to-[oklch(0.68_0.18_10)] text-[oklch(0.2_0.05_15)] -rotate-[7deg] translate-y-5",
    pos: "left-[17%] hidden sm:flex",
  },
  {
    type: "LDRRMP",
    name: "Disaster risk",
    line: "Evacuation centre · 300 families",
    icon: Siren,
    className:
      "from-[oklch(0.86_0.17_150)] to-[oklch(0.74_0.17_150)] text-[oklch(0.2_0.06_150)] rotate-[7deg] translate-y-5",
    pos: "right-[17%] hidden sm:flex",
  },
  {
    type: "AIP",
    name: "Investment",
    line: "2027 budget lines",
    icon: Landmark,
    className:
      "from-[oklch(0.6_0.17_255)] to-[oklch(0.45_0.18_265)] text-white rotate-[14deg] translate-y-14",
    pos: "right-[2%] hidden lg:flex",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[oklch(0.14_0.02_285)] text-white">
      {/* Glow and star field: decoration only. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-20%] left-1/2 h-[42rem] w-[62rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.52_0.235_282/0.45),transparent)]" />
        <div className="absolute right-[-10%] bottom-[-10%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,oklch(0.7_0.15_200/0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(oklch(1_0_0/0.12)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] bg-[size:28px_28px]" />
      </div>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-white/50"
        >
          <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-[oklch(0.14_0.02_285)]">
            <Route aria-hidden className="size-5" />
          </span>
          <span className="font-heading text-lg font-extrabold tracking-tight">
            PlanTrace
          </span>
        </Link>
        <nav
          aria-label="Site"
          className="hidden rounded-full border border-white/10 bg-white/5 p-1.5 backdrop-blur-xl md:block"
        >
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={"current" in item ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full px-5 font-heading text-sm font-semibold transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-white/50",
                    "current" in item
                      ? "bg-white/12 text-white"
                      : "text-white/70 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link
          href="/plans"
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-5 font-heading text-sm font-bold text-[oklch(0.14_0.02_285)] transition-transform duration-150 outline-none hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-white/50"
        >
          Open the app
          <ArrowUpRight aria-hidden className="size-4" />
        </Link>
      </header>

      <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-4 pt-8 text-center sm:px-8 sm:pt-14">
        <p className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pr-3 pl-1.5 text-xs whitespace-nowrap text-white/80 backdrop-blur sm:text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.88_0.17_95)] px-2 py-0.5 text-xs font-bold text-[oklch(0.25_0.06_95)]">
            <FlaskConical aria-hidden className="size-3" />
            Synthetic demo
          </span>
          City of Sampaguita<span className="hidden sm:inline">, Davao Region</span>
        </p>

        <h1 className="mt-6 max-w-4xl animate-fade-up font-heading text-4xl leading-[1.05] font-extrabold tracking-tight [animation-delay:80ms] sm:text-7xl">
          Trace every plan
          <span className="block bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">
            <span className="font-serif font-normal">C</span>atch every conflict
          </span>
        </h1>

        <p className="mt-6 max-w-xl animate-fade-up text-base text-white/70 [animation-delay:160ms] sm:text-lg">
          Upload a city&apos;s land use, development, disaster and investment
          plans. PlanTrace lines up every project and flags duplicates, orphans
          and clashes, each with the page it came from.
        </p>

        <div className="mt-8 flex animate-fade-up flex-wrap items-center justify-center gap-3 [animation-delay:240ms]">
          <Link
            href="/plans"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[oklch(0.52_0.235_282)] px-6 font-heading font-bold text-white shadow-[0_12px_32px_-10px_oklch(0.52_0.235_282)] transition-transform duration-150 outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-white/60"
          >
            <Sparkles aria-hidden className="size-4" />
            Start tracing plans
          </Link>
          <Link
            href="/findings"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 font-heading font-bold text-white backdrop-blur transition-colors duration-150 outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/50"
          >
            See the findings
          </Link>
        </div>

        {/* Floating tags, like cursors of people reviewing together. */}
        <FloatingTag
          className="top-[22%] left-[6%] bg-[oklch(0.72_0.12_195)] text-[oklch(0.18_0.04_200)]"
          cursor="text-[oklch(0.72_0.12_195)] -right-4 -top-4 rotate-90"
        >
          Barangay 9
        </FloatingTag>
        <FloatingTag
          className="top-[34%] right-[6%] bg-[oklch(0.72_0.16_15)] text-[oklch(0.18_0.05_15)] [animation-delay:1.5s]"
          cursor="text-[oklch(0.72_0.16_15)] -left-4 -top-4"
        >
          ₱25M housing
        </FloatingTag>

        <div className="relative mt-14 h-[23rem] w-full max-w-6xl sm:mt-16">
          {SIDE_CARDS.map((c, i) => (
            <PlanCard key={c.type} card={c} delay={300 + i * 90} />
          ))}
          <div
            className="absolute bottom-0 left-1/2 z-20 flex h-[21rem] w-[17rem] -translate-x-1/2 animate-fade-up flex-col gap-4 rounded-[2rem] border border-white/20 bg-gradient-to-br from-[oklch(0.8_0.12_200)] to-[oklch(0.62_0.13_215)] p-5 text-left text-[oklch(0.16_0.04_215)] shadow-[0_30px_80px_-20px_oklch(0.6_0.13_215/0.7)] [animation-delay:400ms]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading text-2xl font-extrabold">Conflict</p>
                <p className="text-sm font-bold opacity-80">
                  Caught before it&apos;s funded
                </p>
              </div>
              <Link
                href="/plans"
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 font-heading text-xs font-bold whitespace-nowrap text-[oklch(0.16_0.04_215)] outline-none hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/60"
              >
                Try it
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <span className="flex size-28 animate-float items-center justify-center rounded-[2rem] bg-white/90 font-heading text-6xl font-extrabold text-[oklch(0.53_0.21_25)] shadow-[0_20px_40px_-12px_oklch(0.2_0.05_215/0.5)]">
                C
              </span>
            </div>
            <ul className="flex flex-col gap-2 text-sm font-bold">
              <li className="flex items-center gap-2 rounded-2xl bg-white/45 px-3 py-2">
                <House aria-hidden className="size-4 shrink-0" />
                CDP housing, Barangay 9
              </li>
              <li className="flex items-center gap-2 rounded-2xl bg-white/45 px-3 py-2">
                <Building2 aria-hidden className="size-4 shrink-0" />
                LDRRMP evacuation centre
              </li>
            </ul>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-24 bg-gradient-to-t from-[oklch(0.14_0.02_285)] to-transparent"
          />
        </div>
      </main>
    </div>
  );
}

function PlanCard({
  card,
  delay,
}: {
  card: (typeof SIDE_CARDS)[number];
  delay: number;
}) {
  const Icon = card.icon;
  return (
    <div
      aria-hidden
      className={cn("absolute bottom-0 w-[15rem]", card.pos)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={cn(
          "flex h-[19rem] w-full animate-fade-up flex-col gap-3 rounded-[2rem] border border-white/15 bg-gradient-to-br p-5 text-left shadow-[0_24px_60px_-24px_black]",
          card.className,
        )}
        style={{ animationDelay: `${delay}ms` }}
      >
        <div>
          <p className="font-heading text-xl font-extrabold">{card.type}</p>
          <p className="text-sm font-bold opacity-80">{card.name}</p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-white/25 backdrop-blur">
            <Icon className="size-10" />
          </span>
        </div>
        <p className="rounded-2xl bg-white/20 px-3 py-2 text-sm font-bold">
          {card.line}
        </p>
      </div>
    </div>
  );
}

function FloatingTag({
  children,
  className,
  cursor,
}: {
  children: React.ReactNode;
  className: string;
  cursor: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute hidden animate-float rounded-full px-3 py-1 font-heading text-sm font-bold shadow-lg md:inline-block",
        className,
      )}
    >
      {children}
      <MousePointer2
        className={cn("absolute size-5 fill-current", cursor)}
      />
    </span>
  );
}
