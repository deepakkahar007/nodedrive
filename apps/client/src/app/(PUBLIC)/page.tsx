import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">NodeDrive</h1>
        <p className="text-muted-foreground">
          Store and share files from anywhere.
        </p>

        <Button>
          <Link href={"/auth"}>Sign IN</Link>
        </Button>
      </div>

      {/* {session ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Signed in as {session.user.email}
          </p>
          <div className="flex gap-3">
            <Link href="/dashboard" className={cn(buttonVariants())}>
              Go to dashboard
            </Link>
            <SignOutButton />
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <Link href="/sign-in" className={cn(buttonVariants())}>
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Create account
          </Link>
        </div>
      )} */}
    </main>
  );
}
