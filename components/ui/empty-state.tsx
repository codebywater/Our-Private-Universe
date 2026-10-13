import { cn } from "@/lib/utils/cn";

/** Пустое состояние: крупная цитата + пояснение + действие. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-8 grid size-16 place-items-center rounded-full border border-line-strong text-accent glow-accent">
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-3xl font-light italic leading-snug text-text text-glow sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}
