import { AuthTabs } from "@/components/auth/auth-tabs";
import { BrandMark } from "@/components/brand-mark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AuthPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-background lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-background)_1px,transparent_0)] [background-size:26px_26px] opacity-[0.08]"
        />
        <BrandMark className="relative size-52 self-end text-background/25" />
        <div className="relative max-w-md">
          <p className="font-(family-name:--font-poppins) text-sm font-semibold text-background/60">
            NodeDrive
          </p>
          <p className="mt-4 font-(family-name:--font-poppins) text-4xl leading-[1.1] font-medium tracking-tight">
            Store and share files from anywhere.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-sm gap-8">
          <div className="grid gap-2 lg:hidden">
            <BrandMark className="size-10 text-foreground" />
            <p className="font-(family-name:--font-poppins) text-sm font-semibold text-muted-foreground">
              NodeDrive
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Welcome to NodeDrive</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuthTabs />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
