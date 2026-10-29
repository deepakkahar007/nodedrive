import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  HardDrive,
  LayoutGrid,
  MoreHorizontal,
  Search,
  Share2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

const features = [
  {
    icon: HardDrive,
    title: "Everything in one place",
    description: "Keep uploads and folders organized in a shared drive.",
  },
  {
    icon: Share2,
    title: "Share with the right people",
    description: "Give teammates access to files without extra steps.",
  },
  {
    icon: Building2,
    title: "A home for every team",
    description: "Bring people and shared work together in an organization.",
  },
];

const files = [
  {
    name: "Brand refresh.fig",
    detail: "4.8 MB",
    icon: FileImage,
    color: "text-[#6957d9] bg-[#eeeaff]",
  },
  {
    name: "Campaign plan.xlsx",
    detail: "820 KB",
    icon: FileSpreadsheet,
    color: "text-[#25835a] bg-[#e2f5e9]",
  },
  {
    name: "Project brief.pdf",
    detail: "2.1 MB",
    icon: FileText,
    color: "text-[#df685d] bg-[#fff0ed]",
  },
];

function SiteHeader() {
  return (
    <header className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
      <Link
        href="/"
        className="flex items-center gap-2.5"
        aria-label="NodeDrive home"
      >
        <BrandMark className="size-8 text-[#3d63f5]" />
        <span className="font-(family-name:--font-poppins) text-lg font-semibold tracking-[-0.04em]">
          NodeDrive
        </span>
      </Link>

      <nav
        aria-label="Main navigation"
        className="hidden items-center gap-8 md:flex"
      >
        <Link
          href="#features"
          className="text-sm text-[#53627b] transition-colors hover:text-[#17233d] dark:text-[#aeb9cc] dark:hover:text-white"
        >
          Product
        </Link>
        <Link
          href="#teams"
          className="text-sm text-[#53627b] transition-colors hover:text-[#17233d] dark:text-[#aeb9cc] dark:hover:text-white"
        >
          Teams
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Link
          href="/auth"
          className="rounded-md px-2 py-2 text-sm font-medium text-[#53627b] transition-colors hover:text-[#17233d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3d63f5] dark:text-[#aeb9cc] dark:hover:text-white"
        >
          Sign in
        </Link>
        <Button
          render={<Link href="/auth" />}
          className="h-10 rounded-full bg-[#3d63f5] px-4 text-white hover:bg-[#2e52df]"
        >
          Get started
          <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}

function DrivePreview() {
  return (
    <div
      role="img"
      aria-label="NodeDrive workspace showing shared folders and recent team files"
      className="relative mx-auto w-full max-w-[620px] rounded-[28px] bg-[#dfe8ff] p-3 shadow-[0_32px_80px_-42px_rgba(35,68,146,0.42)] sm:p-5"
    >
      <div className="overflow-hidden rounded-[19px] border border-[#dce3ef] bg-white">
        <div className="flex h-11 items-center gap-1.5 border-b border-[#e9edf4] px-4">
          <span className="size-2 rounded-full bg-[#ff887d]" />
          <span className="size-2 rounded-full bg-[#f4c957]" />
          <span className="size-2 rounded-full bg-[#59c68a]" />
          <span className="ml-3 text-[10px] font-medium text-[#929db0]">
            nodedrive.app
          </span>
        </div>

        <div className="flex min-h-[350px]">
          <aside className="hidden w-[156px] shrink-0 border-r border-[#edf0f5] bg-[#fbfcfe] p-3 sm:block">
            <div className="mb-5 flex items-center gap-2 px-2 pt-1">
              <BrandMark className="size-5 text-[#3d63f5]" />
              <span className="text-[11px] font-semibold text-[#26334b]">
                NodeDrive
              </span>
            </div>
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center gap-2 rounded-lg bg-[#e9efff] px-2.5 py-2 font-semibold text-[#3157e8]">
                <LayoutGrid className="size-3.5" /> My drive
              </div>
              <div className="flex items-center gap-2 px-2.5 py-2 text-[#7b879b]">
                <Users className="size-3.5" /> Shared with me
              </div>
              <div className="flex items-center gap-2 px-2.5 py-2 text-[#7b879b]">
                <Building2 className="size-3.5" /> Organizations
              </div>
            </div>
            <div className="mt-7 border-t border-[#edf0f5] pt-4">
              <p className="px-2 text-[9px] font-medium text-[#a0a9b8]">
                STORAGE
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e9edf4]">
                <div className="h-full w-[38%] rounded-full bg-[#3d63f5]" />
              </div>
              <p className="mt-2 px-2 text-[9px] text-[#8b97a9]">
                3.8 GB of 10 GB
              </p>
            </div>
          </aside>

          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] text-[#8a96a9]">
                  Workspace / Design team
                </p>
                <h2 className="mt-1 text-base font-semibold tracking-[-0.03em] text-[#1d2a41] sm:text-lg">
                  Recent files
                </h2>
              </div>
              <div className="flex size-8 items-center justify-center rounded-lg border border-[#e6eaf1] text-[#6f7b90]">
                <Search className="size-3.5" />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl bg-[#f3f6fc] px-3 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#e2eaff] text-[#3d63f5]">
                  <Folder className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-[#29364d]">
                    Q3 product launch
                  </p>
                  <p className="mt-0.5 text-[9px] text-[#8793a6]">
                    Shared folder · 12 files
                  </p>
                </div>
              </div>
              <MoreHorizontal className="size-4 shrink-0 text-[#8793a6]" />
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[9px] font-medium text-[#9aa4b3]">
                <span>Name</span>
                <span>Size</span>
              </div>
              <div className="divide-y divide-[#f0f2f6]">
                {files.map((file) => {
                  const Icon = file.icon;
                  return (
                    <div
                      key={file.name}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-md ${file.color}`}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="truncate text-[10px] font-medium text-[#4a576d]">
                          {file.name}
                        </span>
                      </div>
                      <span className="shrink-0 text-[9px] text-[#8b97a9]">
                        {file.detail}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 right-4 flex items-center gap-2.5 rounded-2xl border border-[#e5eaf1] bg-white px-3 py-2.5 shadow-[0_12px_34px_-18px_rgba(23,35,61,0.4)] sm:right-8">
        <div className="flex -space-x-2" aria-hidden="true">
          <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#e7c4a8] text-[8px] font-semibold text-[#654530]">
            AM
          </span>
          <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#c4d6ff] text-[8px] font-semibold text-[#304a88]">
            JL
          </span>
          <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#c8ead7] text-[8px] font-semibold text-[#32654a]">
            SK
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[#26334b]">In sync</p>
          <p className="text-[9px] text-[#8995a7]">Shared with your team</p>
        </div>
      </div>
    </div>
  );
}

function FeatureSection() {
  return (
    <section
      id="features"
      className="scroll-mt-10 bg-white py-20 sm:py-24 dark:bg-[#151f31]"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-[#3d63f5] dark:text-[#9db2ff]">
            A clearer way to work
          </p>
          <h2 className="mt-3 font-(family-name:--font-poppins) text-3xl leading-tight font-medium tracking-[-0.045em] text-[#17233d] sm:text-4xl dark:text-[#f1f5fb]">
            The tools your team needs. Nothing in the way.
          </h2>
        </div>

        <div className="mt-12 grid gap-9 border-t border-[#e6ebf2] pt-8 md:grid-cols-3 md:gap-8 dark:border-[#2a364a]">
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title} className="max-w-sm">
              <Icon aria-hidden="true" className="size-5 text-[#3d63f5]" />
              <h3 className="mt-5 text-base font-semibold tracking-[-0.02em] text-[#17233d] dark:text-[#f1f5fb]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#68768d] dark:text-[#aeb9cc]">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamSection() {
  return (
    <section id="teams" className="scroll-mt-10 py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
        <div className="max-w-lg">
          <p className="text-sm font-medium text-[#3d63f5] dark:text-[#9db2ff]">
            Made for teams
          </p>
          <h2 className="mt-3 font-(family-name:--font-poppins) text-3xl leading-tight font-medium tracking-[-0.045em] text-[#17233d] sm:text-4xl dark:text-[#f1f5fb]">
            Keep everyone on the same page.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-[#68768d] dark:text-[#aeb9cc]">
            Give each organization a shared home. Bring teammates in and keep
            project files together.
          </p>
          <Link
            href="/auth"
            className="mt-7 inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-[#3157e8] transition-colors hover:text-[#17233d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3d63f5] dark:text-[#9db2ff] dark:hover:text-white"
          >
            Create a workspace{" "}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <div className="rounded-[24px] bg-[#eaf0fc] p-4 sm:p-7 dark:bg-[#202d42]">
          <div className="mx-auto max-w-md rounded-2xl border border-[#e7ebf2] bg-white p-5 shadow-[0_24px_60px_-44px_rgba(23,35,61,0.35)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e9efff] text-[#3d63f5]">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#26334b]">
                    Northstar Studio
                  </p>
                  <p className="mt-0.5 text-xs text-[#8b97a9]">
                    Organization workspace
                  </p>
                </div>
              </div>
              <Users className="size-4 shrink-0 text-[#8b97a9]" />
            </div>

            <div className="mt-6 space-y-2">
              {[
                ["Product launch", "12 files"],
                ["Brand assets", "8 files"],
              ].map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl border border-[#edf0f5] px-3.5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Folder
                      aria-hidden="true"
                      className="size-4 text-[#3d63f5]"
                    />
                    <span className="text-sm font-medium text-[#46546b]">
                      {name}
                    </span>
                  </div>
                  <span className="text-xs text-[#8995a7]">{count}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-[#edf0f5] pt-4 text-xs text-[#68768d]">
              <Share2 aria-hidden="true" className="size-3.5 text-[#3d63f5]" />
              Shared with your organization
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[#e3e9f1] bg-[#f6f8fc] dark:border-[#2a364a] dark:bg-[#101827]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="NodeDrive home"
        >
          <BrandMark className="size-6 text-[#3d63f5]" />
          <span className="font-(family-name:--font-poppins) text-sm font-semibold tracking-[-0.04em] text-[#26334b] dark:text-[#eef3fc]">
            NodeDrive
          </span>
        </Link>
        <div className="flex items-center gap-5 text-xs text-[#68768d] dark:text-[#aeb9cc]">
          <Link
            href="#features"
            className="transition-colors hover:text-[#17233d] dark:hover:text-white"
          >
            Product
          </Link>
          <Link
            href="#teams"
            className="transition-colors hover:text-[#17233d] dark:hover:text-white"
          >
            Teams
          </Link>
          <Link
            href="/auth"
            className="transition-colors hover:text-[#17233d] dark:hover:text-white"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-[#8995a7] dark:text-[#8795ad]">
          © {new Date().getFullYear()} NodeDrive
        </p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <main className="overflow-hidden bg-[#f6f8fc] text-[#17233d] dark:bg-[#101827] dark:text-[#eef3fc]">
      <SiteHeader />

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:py-24">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dce5f7] bg-white px-3 py-1.5 text-xs font-medium text-[#53627b] dark:border-[#33415a] dark:bg-[#18243a] dark:text-[#bdc8da]">
            <span className="size-1.5 rounded-full bg-[#3d63f5]" />
            Shared storage for teams
          </p>
          <h1 className="max-w-xl font-(family-name:--font-poppins) text-[clamp(2.8rem,6vw,5.15rem)] leading-[1.04] font-medium tracking-[-0.065em] text-[#17233d] dark:text-[#f1f5fb]">
            A home for every team file.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#68768d] sm:text-lg sm:leading-8 dark:text-[#aeb9cc]">
            Upload, organize, and share work from one place—without losing track
            of who has access.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              render={<Link href="/auth" />}
              className="h-12 rounded-full bg-[#3d63f5] px-6 text-sm text-white shadow-[0_8px_20px_-10px_rgba(61,99,245,0.8)] hover:bg-[#2e52df]"
            >
              Create your workspace <ArrowUpRight aria-hidden="true" />
            </Button>
            <Link
              href="#features"
              className="inline-flex h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-[#53627b] transition-colors hover:text-[#17233d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3d63f5] dark:text-[#aeb9cc] dark:hover:text-white"
            >
              See how it works{" "}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <p className="mt-6 text-xs text-[#8995a7] dark:text-[#8795ad]">
            Start with your files. Invite your team when ready.
          </p>
        </div>

        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:delay-150 motion-safe:duration-700 lg:pl-2">
          <DrivePreview />
        </div>
      </section>

      <FeatureSection />
      <TeamSection />

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20">
        <div className="flex flex-col gap-7 rounded-[24px] bg-[#17233d] px-6 py-9 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-11 dark:bg-[#202d42]">
          <div className="max-w-xl">
            <h2 className="font-(family-name:--font-poppins) text-2xl leading-tight font-medium tracking-[-0.04em] sm:text-3xl">
              Make room for better work.
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#c0cadd]">
              Bring your files and team into one shared space.
            </p>
          </div>
          <Button
            render={<Link href="/auth" />}
            className="h-11 shrink-0 rounded-full bg-[#b8f4d5] px-5 text-sm font-semibold text-[#17233d] hover:bg-[#9be9c2]"
          >
            Get started <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
