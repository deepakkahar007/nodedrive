"use client";

import { signUpWithEmail } from "@repo/auth/client";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { dashboardUrl } from "@/lib/routes";
import { AuthField } from "./auth-field";
import { GoogleAuthButton } from "./google-auth-button";

const schema = z.object({
  name: z.string().min(1, "Enter your name"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setError(null);
      const { error: signUpError } = await signUpWithEmail({
        name: value.name,
        email: value.email,
        password: value.password,
        callbackURL: dashboardUrl(),
      });
      if (signUpError) {
        setError(signUpError);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    },
  });

  return (
    <div className="grid gap-4">
      <GoogleAuthButton onError={setError} />

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <AuthField field={field} label="Name" autoComplete="name" />
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <AuthField
              field={field}
              label="Email"
              type="email"
              autoComplete="email"
            />
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <AuthField
              field={field}
              label="Password"
              type="password"
              autoComplete="new-password"
            />
          )}
        </form.Field>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl bg-[#3d63f5] text-white hover:bg-[#2e52df]"
            >
              Create account
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
