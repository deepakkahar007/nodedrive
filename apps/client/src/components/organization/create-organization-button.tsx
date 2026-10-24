"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateOrganizationDialog } from "./create-organization-dialog";

export function CreateOrganizationButton({
  className,
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        New organization
      </Button>
      <CreateOrganizationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
