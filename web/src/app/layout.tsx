import type { Metadata } from "next";
import Link from "next/link";
import { Atkinson_Hyperlegible, Geist_Mono } from "next/font/google";
import { Route } from "lucide-react";
import { MainNav } from "@/components/main-nav";
import { Providers } from "./providers";
import "./globals.css";

// Atkinson Hyperlegible: designed for low-vision readers, so letters like
// 1/l/I and 0/O never get mixed up in codes and peso amounts.
const bodyFont = Atkinson_Hyperlegible({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlanTrace",
  description: "Plan consistency checker for the City of Sampaguita",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="border-b bg-card">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
              <Link
                href="/plans"
                className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Route aria-hidden className="size-5" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-lg font-bold">PlanTrace</span>
                  <span className="text-xs text-muted-foreground">
                    City of Sampaguita
                  </span>
                </span>
              </Link>
              <MainNav />
              <p className="ml-auto rounded-full border border-warning/30 bg-warning-soft px-3 py-1 text-sm font-medium text-warning">
                Synthetic demo data
              </p>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
