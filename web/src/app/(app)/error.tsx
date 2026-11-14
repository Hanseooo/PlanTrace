"use client";

import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { card } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";

/** A screen that threw while rendering: say so, offer a retry and a way out. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className={`${card} mx-auto flex max-w-xl flex-col items-center gap-4 p-10 text-center`}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert aria-hidden className="size-7" />
      </span>
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="text-muted-foreground">
        This screen hit an unexpected problem. Your saved work is safe.
        {error.message && (
          <span className="mt-1 block text-sm">Details: {error.message}</span>
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCw aria-hidden />
          Try again
        </Button>
        <Link href="/plans" className={buttonVariants({ variant: "outline" })}>
          Go to the plans list
        </Link>
      </div>
    </div>
  );
}
