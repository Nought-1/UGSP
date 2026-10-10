"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SIGN_IN_ERRORS, signInSchema, type SignInValues } from "@/lib/validators";

// Seed accounts from scripts/seed.ts; the shortcut buttons only render in development
const DEV_ACCOUNTS = [
  { label: "Admin", email: "admin@rto.gov.in", password: "admin123" },
  { label: "Officer", email: "officer1@rto.gov.in", password: "officer123" },
];

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    fetch("/api/signup")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setIsFirstRun(Boolean(data?.isFirstTimeSetup)))
      .catch(() => {});
  }, []);

  async function onSubmit(values: SignInValues) {
    const res = await signIn("credentials", { ...values, redirect: false });
    if (!res || res.error) {
      setError("root", {
        message: SIGN_IN_ERRORS[res?.error ?? ""] ?? "Could not sign in. Please try again.",
      });
      return;
    }

    // Same-site paths only; "/" is sent to the role's home page by proxy.ts
    const callbackUrl = searchParams.get("callbackUrl");
    const safeTarget = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
    router.replace(safeTarget);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {isFirstRun && (
        <div className="flex items-center justify-between gap-3 border border-status-pending-border bg-status-pending-bg px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-status-pending">
            <Sparkles className="size-4" />
            No administrator exists yet.
          </span>
          <Link href="/sign-up" className="font-medium text-primary hover:underline">
            Run first-time setup
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Use your staff email and password.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent>
            <FieldGroup>
              {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}

              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="officer@rto.gov.in"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>

              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    {...register("password")}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((shown) => !shown)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError errors={[errors.password]} />
              </Field>
            </FieldGroup>
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Sign in
            </Button>

            {process.env.NODE_ENV === "development" && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                Dev accounts:
                {DEV_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setValue("email", account.email);
                      setValue("password", account.password);
                    }}
                  >
                    {account.label}
                  </Button>
                ))}
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
