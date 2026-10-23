import type { LucideIcon } from "lucide-react";
import { UploadDialog } from "./upload-dialog";

export function SectionPlaceholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <UploadDialog />
      </div>

      <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
        <div>
          <Icon
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <p className="mt-3 text-sm font-medium">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Files you add will show up here.
          </p>
        </div>
      </div>
    </section>
  );
}
