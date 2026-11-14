import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function PlanPpasPage() {
  return (
    <div className="flex flex-col items-start gap-4">
      <Link href="/plans" className={buttonVariants({ variant: "outline" })}>
        Back to plans
      </Link>
      <h1 className="text-2xl font-semibold">PPA table</h1>
    </div>
  );
}
