import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { buttonVariants } from "@/components/ui/button";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlanTrace",
  description: "Plan consistency checker for the City of Sampaguita",
};

const NAV_LINKS = [
  { href: "/plans", label: "Plans" },
  { href: "/findings", label: "Findings" },
  { href: "/ccc", label: "CCC matrix" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="border-b">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
              <span className="font-semibold">PlanTrace</span>
              <nav aria-label="Main" className="flex gap-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <p className="ml-auto rounded-md bg-muted px-2 py-1 text-sm text-muted-foreground">
                Synthetic demo data
              </p>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
