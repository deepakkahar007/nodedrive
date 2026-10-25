"use client";

import { createOrganization } from "@repo/auth/client";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { OrganizationLogo } from "@/components/organization/organization-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { organizationLogoOptions } from "@/lib/organization-logos";
import { createSlugSuffix, slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(1, "Enter an organization name"),
  slug: z
    .string()
    .min(1, "Enter a slug")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
});

const DEFAULT_LOGO = "building";

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slugBase, setSlugBase] = useState<string | null>(null);
  const [suffix, setSuffix] = useState(createSlugSuffix);
  const [logo, setLogo] = useState<string>(DEFAULT_LOGO);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slug = `${slugify(slugBase ?? name)}-${suffix}`;

  function reset() {
    setName("");
    setSlugBase(null);
    setSuffix(createSlugSuffix());
    setLogo(DEFAULT_LOGO);
    setError(null);
    setIsSubmitting(false);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);

    if (!next) reset();
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = schema.safeParse({ name, slug });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form values");
      return;
    }

    setIsSubmitting(true);
    const { data, error: createError } = await createOrganization({
      name: parsed.data.name,
      slug: parsed.data.slug,
      logo,
    });
    setIsSubmitting(false);

    if (createError) {
      setError(createError);
      return;
    }

    handleOpenChange(false);

    if (data?.id) {
      router.push(`/dashboard/organization/${data.id}`);
    }

    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>
              Shared files, folders and members live here.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3">
            <OrganizationLogo
              logo={logo}
              className="size-10 rounded-xl"
              iconClassName="size-5"
            />
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="organization-name">Name</Label>
              <Input
                id="organization-name"
                name="name"
                autoComplete="organization"
                placeholder="Acme Design"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(error) && !name.trim()}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="organization-slug">Slug</Label>
            <div className="flex items-center gap-2">
              <Input
                id="organization-slug"
                name="slug"
                autoComplete="off"
                spellCheck={false}
                value={slugBase ?? name}
                onChange={(event) => setSlugBase(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Regenerate slug"
                title="Regenerate slug"
                onClick={() => setSuffix(createSlugSuffix())}
              >
                <RefreshCw aria-hidden="true" />
              </Button>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              nodedrive.app/{slug}
            </p>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Logo</legend>
            <div className="grid grid-cols-5 gap-2">
              {organizationLogoOptions.map(({ name: option, label, Icon }) => {
                const selected = logo === option;

                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    aria-label={label}
                    title={label}
                    onClick={() => setLogo(option)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg border text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected &&
                        "border-sidebar-primary bg-sidebar-active text-sidebar-primary",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
