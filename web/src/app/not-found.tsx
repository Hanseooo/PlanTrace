import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-secondary text-secondary-foreground">
        <Compass aria-hidden className="size-8" />
      </span>
      <p className="font-heading text-sm font-bold tracking-widest text-primary uppercase">
        404
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        This page isn&apos;t in any plan
      </h1>
      <p className="max-w-md text-muted-foreground">
        The link may be old or mistyped. Go back to the plans list and start
        from there.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/plans" className={buttonVariants({ size: "lg" })}>
          Go to the plans list
        </Link>
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Home
        </Link>
      </div>
    </main>
  );
}
