import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchBar() {
  return (
    <form action="/dashboard/search" className="relative w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        name="q"
        type="search"
        aria-label="Search files"
        placeholder="Search in NodeDrive"
        autoComplete="off"
        className="h-11 rounded-full border-transparent bg-muted pl-10 text-sm shadow-none focus-visible:bg-background"
      />
    </form>
  );
}
