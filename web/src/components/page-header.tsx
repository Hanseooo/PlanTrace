/** A page's title, one plain-language line on what it is for, and its actions. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  /** A round "back" control shown before the title. */
  back?: React.ReactNode;
}) {
  return (
    <div className="flex animate-fade-up flex-wrap items-end justify-between gap-4">
      <div className="flex items-start gap-4">
        {back}
        <div className="flex max-w-3xl flex-col gap-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="text-base text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** The white panel most page sections sit in. */
export const card = "rounded-3xl border border-border/70 bg-card shadow-card";
