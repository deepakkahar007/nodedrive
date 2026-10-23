export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="14" y="14" width="58" height="58" rx="12" />
      <rect x="48" y="48" width="58" height="58" rx="12" />
      <circle cx="90" cy="30" r="7" />
    </svg>
  );
}
