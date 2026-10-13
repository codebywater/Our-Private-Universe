import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

export function PageSkeletonHeader() {
  return (
    <div className="mb-12 space-y-4" role="status" aria-label="Загрузка">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-14 w-full max-w-md" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}
