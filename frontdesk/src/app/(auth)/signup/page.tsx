"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NOTIFY_CHANNELS, signupSchema, type SignupInput } from "@/lib/validators";
import { apiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { Lock, Mail, Phone, UserRound } from "lucide-react";

export default function SignupPage() {
  const { t, tm, te } = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", phone: "", password: "", email: "", notifyChannels: ["SMS"] },
  });

  const onSubmit = async (values: SignupInput) => {
    setError(null);
    try {
      await apiClient("/signup", { method: "POST", body: JSON.stringify(values) });
    } catch (err) {
      setError(te(err));
      return;
    }

    // Account exists now; sign in with the same credentials
    const login = await signIn("credentials", {
      phone: values.phone,
      password: values.password,
      redirect: false,
    });
    if (!login?.ok) {
      router.replace("/login");
      return;
    }
    router.replace("/citizen/dashboard");
    router.refresh();
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <Card className="shadow-xl border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-brand">{t("signup.title")}</CardTitle>
          <CardDescription>{t("signup.subtitle")}</CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label={t("form.name")}
              autoComplete="name"
              placeholder="Ramesh Sharma"
              leftIcon={<UserRound className="w-4 h-4" />}
              error={tm(errors.name?.message)}
              {...register("name")}
            />

            <Input
              label={t("form.phone")}
              type="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              helperText={t("form.phoneHelp")}
              leftIcon={<Phone className="w-4 h-4" />}
              error={tm(errors.phone?.message)}
              {...register("phone")}
            />

            <Input
              label={t("form.password")}
              type="password"
              autoComplete="new-password"
              helperText={t("form.passwordHelp")}
              leftIcon={<Lock className="w-4 h-4" />}
              error={tm(errors.password?.message)}
              {...register("password")}
            />

            <Input
              label={t("form.email")}
              type="email"
              autoComplete="email"
              placeholder="ramesh@example.com"
              helperText={t("form.emailHelp")}
              leftIcon={<Mail className="w-4 h-4" />}
              error={tm(errors.email?.message)}
              {...register("email")}
            />

            <fieldset className="space-y-1.5">
              <legend className="block text-xs font-semibold text-ink uppercase tracking-wider">{t("signup.alertBy")}</legend>
              <div className="flex flex-wrap gap-4 pt-1">
                {NOTIFY_CHANNELS.map((channel) => (
                  <label key={channel} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                    <input type="checkbox" value={channel} className="h-4 w-4 accent-brand" {...register("notifyChannels")} />
                    {t(`channel.${channel}` as const)}
                  </label>
                ))}
              </div>
              {errors.notifyChannels?.message && (
                <p className="text-xs text-red-600 font-medium">{tm(errors.notifyChannels.message)}</p>
              )}
            </fieldset>

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              {t("signup.submit")}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted">
            {t("signup.haveAccount")}{" "}
            <Link href="/login" className="font-semibold text-brand hover:underline">
              {t("nav.signIn")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
