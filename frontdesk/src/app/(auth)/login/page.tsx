"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { useT } from "@/lib/i18n";
import { Phone, Lock, ArrowRight } from "lucide-react";

function LoginForm() {
  const { t, tm } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  const onSubmit = async (values: LoginInput) => {
    setError(null);
    // NextAuth's redirect callback keeps callbackUrl on this origin
    const res = await signIn("credentials", {
      phone: values.phone,
      password: values.password,
      redirect: false,
      callbackUrl: searchParams.get("callbackUrl") ?? "/citizen/dashboard",
    });
    if (!res?.ok || res.error) {
      setError(t("login.wrong"));
      return;
    }
    router.replace(res.url ?? "/citizen/dashboard");
    router.refresh();
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <Card className="shadow-xl border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-brand">{t("login.title")}</CardTitle>
          <CardDescription>{t("login.subtitle")}</CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label={t("form.phone")}
              type="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              leftIcon={<Phone className="w-4 h-4" />}
              error={tm(errors.phone?.message)}
              {...register("phone")}
            />

            <Input
              label={t("form.password")}
              type="password"
              autoComplete="current-password"
              leftIcon={<Lock className="w-4 h-4" />}
              error={tm(errors.password?.message)}
              {...register("password")}
            />

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              <span>{t("nav.signIn")}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted">
            {t("login.newHere")}{" "}
            <Link href="/signup" className="font-semibold text-brand hover:underline">
              {t("login.createAccount")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Next 14 needs useSearchParams inside a Suspense boundary, or `next build` fails on /login
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
