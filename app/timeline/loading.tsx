import { PageSkeletonHeader, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main id="main" className="mx-auto w-full max-w-7xl px-5 pb-32 pt-32 sm:px-8 sm:pt-40">
      <PageSkeletonHeader />
      <div className="mx-auto max-w-5xl space-y-10">
        <Skeleton className="h-48 w-full rounded-3xl sm:w-1/2" />
        <Skeleton className="h-48 w-full rounded-3xl sm:ml-auto sm:w-1/2" />
      </div>
    </main>
  );
}
