import { cn } from "@/lib/utils/cn";

/** Заголовок раздела: «глава» фильма с эйбро-подписью и крупным заголовком. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-12 flex flex-col gap-8 sm:mb-16 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.35em] text-accent">
          {eyebrow}
        </p>
        <h1 className="font-display text-5xl font-light leading-[0.95] tracking-tight text-text text-glow sm:text-7xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
