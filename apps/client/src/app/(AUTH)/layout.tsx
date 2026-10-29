import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your NodeDrive workspace.",
  robots: { index: false, follow: false },
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await getSession()) {
    redirect("/dashboard");
  }

  return children;
}
