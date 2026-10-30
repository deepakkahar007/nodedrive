import { Skeleton } from "@/components/ui/skeleton";

const folderCards = ["a", "b", "c", "d", "e", "f"];
const fileRows = ["a", "b", "c", "d", "e", "f"];

export default function DashboardLoading() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6"
    >
      <span className="sr-only">Loading your drive</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <div className="grid gap-3">
        <Skeleton className="h-4 w-16" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {folderCards.map((key) => (
            <Skeleton key={key} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <Skeleton className="h-4 w-24" />
        <div className="overflow-hidden rounded-xl border">
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_9rem_5rem_2.5rem] items-center gap-3 border-b bg-muted/40 px-3 py-2 lg:grid">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-auto h-3 w-8" />
            <Skeleton className="size-4" />
          </div>
          <div className="divide-y">
            {fileRows.map((key) => (
              <div key={key} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <Skeleton className="h-3.5 w-48 max-w-full" />
                  <Skeleton className="h-3 w-24 lg:hidden" />
                </div>
                <Skeleton className="hidden h-3 w-12 lg:block" />
                <Skeleton className="hidden h-3 w-20 lg:block" />
                <Skeleton className="hidden h-3 w-10 lg:block" />
                <Skeleton className="size-7 shrink-0 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
