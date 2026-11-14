/** A page's title and one plain-language line on what the page is for. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-3xl flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-base text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** The white panel most page sections sit in. */
export const card = "rounded-xl border bg-card shadow-sm";
