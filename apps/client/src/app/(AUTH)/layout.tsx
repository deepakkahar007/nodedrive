import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await getSession()) {
    redirect("/dashboard");
  }

  return (
    <>
      <h1>Auth Layout</h1>
      {children}
    </>
  );
}
