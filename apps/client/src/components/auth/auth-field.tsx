import type { AnyFieldApi } from "@tanstack/react-form";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldErrors } from "./field-errors";

type AuthFieldProps = {
  field: AnyFieldApi;
  label: string;
} & Pick<ComponentProps<typeof Input>, "type" | "autoComplete">;

export function AuthField({
  field,
  label,
  type,
  autoComplete,
}: AuthFieldProps) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium" htmlFor={field.name}>
        {label}
      </Label>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        autoComplete={autoComplete}
        className="h-11 rounded-xl px-3.5"
        value={field.state.value}
        aria-invalid={field.state.meta.errors.length > 0}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      <FieldErrors errors={field.state.meta.errors} />
    </div>
  );
}
