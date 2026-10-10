"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { passwordResetSchema, type PasswordResetValues } from "@/lib/validators";

interface ResetTarget {
  _id: string;
  name: string;
  email: string;
}

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: ResetTarget | null;
}

// An admin sets a new password for a staff member (POST /api/v1/employees/:id/password)
export function ResetPasswordDialog({ open, onOpenChange, employee }: ResetPasswordDialogProps) {
  const [busy, setBusy] = useState(false); // a reset is in flight: keep the dialog open

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {employee
              ? `A new password for ${employee.name} (${employee.email}). Share it with them; they can change it after signing in.`
              : "A new password for this staff member."}
          </DialogDescription>
        </DialogHeader>

        {/* Mounted only while the dialog is open, so the fields start empty every time */}
        {employee && (
          <ResetPasswordForm
            key={employee._id}
            employee={employee}
            onBusyChange={setBusy}
            onCancel={() => onOpenChange(false)}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ResetPasswordFormProps {
  employee: ResetTarget;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}

function ResetPasswordForm({ employee, onBusyChange, onCancel, onDone }: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: PasswordResetValues) {
    onBusyChange(true);
    try {
      const res = await fetch(`/api/v1/employees/${employee._id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("root", { message: data.error ?? "Couldn't reset the password. Please try again." });
        return;
      }
      toast.success("Password reset. A session that is already open stays signed in for up to 12 hours.");
      onDone();
    } catch {
      setError("root", { message: "Couldn't reach the server. Please try again." });
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="reset-password">New password</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="reset-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((shown) => !shown)}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>At least 8 characters.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>

        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="reset-confirm-password">Confirm new password</FieldLabel>
          <Input
            id="reset-confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>
      </div>

      {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Reset password
        </Button>
      </DialogFooter>
    </form>
  );
}
