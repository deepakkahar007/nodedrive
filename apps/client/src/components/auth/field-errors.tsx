export function FieldErrors({ errors }: { errors: unknown[] }) {
  const messages = errors
    .map((error) =>
      typeof error === "string"
        ? error
        : ((error as { message?: string } | undefined)?.message ?? ""),
    )
    .filter(Boolean);
  if (messages.length === 0) return null;
  return <p className="text-sm text-destructive">{messages.join(", ")}</p>;
}
