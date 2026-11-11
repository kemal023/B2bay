export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Bordered shell so admin tables read as one panel instead of loose rows. */
export function AdminTableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-border">{children}</div>
  );
}
