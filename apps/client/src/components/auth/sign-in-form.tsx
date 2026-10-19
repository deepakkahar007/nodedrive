"use client";

import { authClient } from "@repo/auth/client";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { dashboardUrl } from "@/lib/routes";
import { AuthField } from "./auth-field";
import { GoogleAuthButton } from "./google-auth-button";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setError(null);
      const { error: signInError } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
        callbackURL: dashboardUrl(),
      });
      if (signInError) {
        setError(signInError.message ?? "Could not sign you in");
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
              autoComplete="current-password"
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
            <Button type="submit" disabled={isSubmitting}>
              Sign in
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
