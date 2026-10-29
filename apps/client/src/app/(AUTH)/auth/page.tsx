import { FileText, Folder, Users } from "lucide-react";
import Link from "next/link";
import { AuthTabs } from "@/components/auth/auth-tabs";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function WorkspacePreview() {
  return (
    <div
      role="img"
      aria-label="Shared NodeDrive workspace with folders and team files"
      className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[#b8f4d5]/15 text-[#b8f4d5]">
            <Folder className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Design team</p>
            <p className="mt-0.5 text-xs text-white/55">Shared workspace</p>
          </div>
        </div>
        <Users className="size-4 text-white/55" />
      </div>

      <div className="mt-3 space-y-1">
        {[
          ["Product launch", "12 files"],
          ["Brand guidelines.pdf", "Updated today"],
        ].map(([name, detail], index) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-xl px-2 py-3"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/[0.08] text-[#b8f4d5]">
              {index === 0 ? (
                <Folder className="size-4" />
              ) : (
                <FileText className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white/90">
                {name}
              </p>
              <p className="mt-0.5 text-xs text-white/50">{detail}</p>
            </div>
            {index === 0 ? (
              <span className="size-2 rounded-full bg-[#b8f4d5]" />
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3 border-t border-white/10 pt-4">
        <div className="flex -space-x-2" aria-hidden="true">
          <span className="flex size-7 items-center justify-center rounded-full border-2 border-[#22314c] bg-[#e7c4a8] text-[9px] font-semibold text-[#654530]">
            AM
          </span>
          <span className="flex size-7 items-center justify-center rounded-full border-2 border-[#22314c] bg-[#c4d6ff] text-[9px] font-semibold text-[#304a88]">
            JL
          </span>
          <span className="flex size-7 items-center justify-center rounded-full border-2 border-[#22314c] bg-[#c8ead7] text-[9px] font-semibold text-[#32654a]">
            SK
          </span>
        </div>
        <p className="text-xs text-white/65">Your team, all in sync</p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#f6f8fc] text-[#17233d] dark:bg-[#101827] dark:text-[#eef3fc]">
      <header className="mx-auto flex h-[76px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3d63f5]"
          aria-label="NodeDrive home"
        >
          <BrandMark className="size-8 text-[#3d63f5]" />
          <span className="font-(family-name:--font-poppins) text-lg font-semibold tracking-[-0.04em]">
            NodeDrive
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-8 px-5 py-6 sm:px-8 sm:py-10 lg:grid-cols-2 lg:gap-14">
        <section className="flex flex-col justify-between gap-9 overflow-hidden rounded-[28px] bg-[#17233d] p-6 text-white sm:rounded-[32px] sm:p-10 lg:min-h-[620px] dark:bg-[#18243a]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/75">
              <span className="size-1.5 rounded-full bg-[#b8f4d5]" />
              Shared work, in sync
            </p>
            <h1 className="mt-8 max-w-lg font-(family-name:--font-poppins) text-3xl leading-[1.1] font-medium tracking-[-0.05em] sm:text-4xl lg:text-[2.8rem]">
              Good work starts in one shared place.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#c0cadd] sm:text-base sm:leading-7">
              Bring your files and teammates together. Pick up where your team
              left off.
            </p>
          </div>

          <div className="hidden sm:block">
            <WorkspacePreview />
          </div>
          <p className="text-xs text-white/50 sm:hidden">
            Your files, folders, and team in one place.
          </p>
        </section>

        <section className="flex items-center justify-center lg:py-8">
          <Card className="w-full max-w-[440px] rounded-[26px] border border-[#e6ebf2] bg-white py-2 shadow-[0_24px_70px_-45px_rgba(23,35,61,0.35)] dark:border-[#2a364a] dark:bg-[#151f31]">
            <CardHeader className="gap-2 px-6 pt-6 sm:px-8 sm:pt-8">
              <p className="text-sm font-medium text-[#3d63f5] dark:text-[#9db2ff]">
                Your workspace awaits
              </p>
              <CardTitle className="font-(family-name:--font-poppins) text-2xl font-medium tracking-[-0.04em] sm:text-[1.75rem]">
                Sign in or create an account
              </CardTitle>
              <CardDescription className="leading-6">
                Access your files and shared folders.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
              <AuthTabs />
            </CardContent>
          </Card>
        </section>
      </div>

      <footer className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 text-xs text-[#8995a7] sm:px-8 dark:text-[#8795ad]">
        <span>© {new Date().getFullYear()} NodeDrive</span>
        <Link
          href="/"
          className="rounded-sm transition-colors hover:text-[#17233d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3d63f5] dark:hover:text-white"
        >
          Back to home
        </Link>
      </footer>
    </main>
  );
}
