import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requireSession();

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
