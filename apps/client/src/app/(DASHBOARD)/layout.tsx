import { requireSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <>
      <h1>Dashboard Layout</h1>
      {children}
    </>
  );
}
