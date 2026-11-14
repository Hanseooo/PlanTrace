"use client";

import {
  CircleHelp,
  Copy,
  FileUp,
  GitBranch,
  ListChecks,
  MapPinned,
  Scale,
  SquarePen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STEPS = [
  {
    icon: FileUp,
    title: "Upload a plan",
    body: "Add a plan as a PDF. PlanTrace reads it and lists its programs, projects and activities (PPAs), each with its source page.",
  },
  {
    icon: SquarePen,
    title: "Check and confirm",
    body: "Open the plan, fix anything read wrong, then confirm it. Only confirmed plans go into the checks.",
  },
  {
    icon: ListChecks,
    title: "Review findings",
    body: "Run the checks on Findings. Confirm each real problem or reject a false alarm, then export the CCC matrix.",
  },
] as const;

const CHECKS = [
  { icon: Copy, name: "Duplicate", body: "The same project in two plans." },
  {
    icon: GitBranch,
    name: "Orphan",
    body: "An AIP project with no parent in the CDP.",
  },
  {
    icon: MapPinned,
    name: "Zone",
    body: "A project where the land use plan forbids it.",
  },
  {
    icon: Scale,
    name: "CCC",
    body: "Two projects in one place that work against each other.",
  },
] as const;

/** The "How it works" button and its modal: the job in 3 steps and the 4 checks. */
export function HowItWorks() {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" className="rounded-full" />}
      >
        <CircleHelp aria-hidden />
        <span className="hidden sm:inline">How it works</span>
        <span className="sr-only sm:hidden">How it works</span>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How PlanTrace works</DialogTitle>
          <DialogDescription>
            PlanTrace reads a city&apos;s plans side by side and flags projects
            that don&apos;t line up, before money is spent. The AI suggests; a
            planner decides.
          </DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="flex flex-col gap-2 rounded-2xl border bg-muted/40 p-4"
            >
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <Icon aria-hidden className="size-4 text-primary" />
              </span>
              <p className="font-heading font-bold">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2">
          <p className="font-heading text-sm font-bold">The four checks</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CHECKS.map(({ icon: Icon, name, body }) => (
              <li key={name} className="flex items-start gap-3 rounded-2xl p-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="text-sm">
                  <span className="font-bold">{name}</span>
                  <span className="block text-muted-foreground">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <DialogClose render={<Button />}>Got it</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
