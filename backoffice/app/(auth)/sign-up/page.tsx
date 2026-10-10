"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { setupSchema, type SetupValues } from "@/lib/validators";

type FieldName = keyof SetupValues;

const ACCOUNT_FIELDS: { name: FieldName; label: string; type?: string; autoComplete?: string; placeholder?: string }[] = [
  { name: "name", label: "Full name", autoComplete: "name", placeholder: "Asha Patel" },
  { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "admin@rto.gov.in" },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
];

const DEPARTMENT_FIELDS: typeof ACCOUNT_FIELDS = [
  { name: "departmentName", label: "Department name", placeholder: "Regional Transport Office" },
  { name: "departmentCode", label: "Department code", placeholder: "RTO-AHM" },
];

export default function SignUpPage() {
  const router = useRouter();
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      departmentName: "",
      departmentCode: "",
    },
  });

  useEffect(() => {
    fetch("/api/signup")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setIsFirstRun(Boolean(data?.isFirstTimeSetup)))
      .catch(() => setIsFirstRun(false));
  }, []);

  async function onSubmit(values: SetupValues) {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError("root", { message: data.error ?? "Setup failed. Please try again." });
      return;
    }

    const login = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    router.replace(login?.error ? "/sign-in" : "/dashboard");
    router.refresh();
  }

  const renderField = ({ name, label, type = "text", autoComplete, placeholder }: (typeof ACCOUNT_FIELDS)[number]) => (
    <Field key={name} data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!errors[name]}
        {...register(name)}
      />
      <FieldError errors={[errors[name]]} />
    </Field>
  );

  if (isFirstRun === null) {
    return (
      <Card className="items-center py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!isFirstRun) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldAlert className="size-5 text-status-pending" />
            Registration is closed
          </CardTitle>
          <CardDescription>
            Staff accounts are created by an administrator from the Employees page. Ask your administrator for
            your sign-in details.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" render={<Link href="/sign-in" />} nativeButton={false}>
            Go to sign in
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">First-time setup</CardTitle>
        <CardDescription>Create the first administrator and the department they manage.</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent>
          <FieldGroup>
            {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
            <FieldSet>
              <FieldLegend>Administrator</FieldLegend>
              <FieldGroup>{ACCOUNT_FIELDS.map(renderField)}</FieldGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend>Department</FieldLegend>
              <FieldGroup>{DEPARTMENT_FIELDS.map(renderField)}</FieldGroup>
            </FieldSet>
          </FieldGroup>
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Create administrator
          </Button>
          <Link href="/sign-in" className="text-center text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
