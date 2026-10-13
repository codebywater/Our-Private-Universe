import { PageSkeletonHeader, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main id="main" className="mx-auto w-full max-w-7xl px-5 pb-32 pt-32 sm:px-8 sm:pt-40">
      <PageSkeletonHeader />
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {[56, 72, 48, 64, 56, 72].map((h, i) => (
          <Skeleton key={i} className={`mb-5 w-full rounded-2xl ${h > 60 ? "h-72" : "h-52"}`} />
        ))}
      </div>
    </main>
  );
}
