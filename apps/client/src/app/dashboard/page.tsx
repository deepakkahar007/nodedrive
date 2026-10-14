import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <SignOutButton />
      </header>
      <p className="text-muted-foreground">
        Signed in as {session.user.email}.
      </p>
      <Link href="/" className="w-fit text-sm underline">
        Back home
      </Link>
    </main>
  );
}
