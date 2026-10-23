import { Search } from "lucide-react";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          {query ? `Results for “${query}”` : "Search your files by name."}
        </p>
      </div>

      <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
        <div>
          <Search
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <p className="mt-3 text-sm font-medium">
            {query ? "No results yet" : "Start typing a file name"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query
              ? "File search is coming with the file browser."
              : "Use the search bar in the header."}
          </p>
        </div>
      </div>
    </section>
  );
}
