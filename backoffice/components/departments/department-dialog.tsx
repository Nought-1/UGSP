"use client";

import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import { notifyConflicts } from "@/components/queue/notify-conflicts";
import { FieldError } from "@/components/ui/field";
import { departmentSchema, type DepartmentValues } from "@/lib/validators";
import { DepartmentForm, EMPTY_DEPARTMENT } from "./department-form";

// What the dialog needs from a department record; list rows and the detail page both fit
export interface EditableDepartment {
  _id: string;
  name: string;
  code: string;
  city?: string;
  address?: string;
  workingHours: { start: string; end: string };
  weekOffDays: number[];
  timezone: string;
  holidays: { date: string; name: string }[];
  isActive: boolean;
}

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: EditableDepartment | null; // empty: create a new department
  onSuccess: () => void;
}

function toFormValues(department?: EditableDepartment | null): DepartmentValues {
  if (!department) return EMPTY_DEPARTMENT;
  return {
    name: department.name,
    code: department.code,
    city: department.city ?? "",
    address: department.address ?? "",
    workingHours: { ...department.workingHours },
    weekOffDays: [...department.weekOffDays],
    timezone: department.timezone,
    holidays: department.holidays.map(({ date, name }) => ({ date, name })),
    isActive: department.isActive,
  };
}

export function DepartmentDialog({ open, onOpenChange, department, onSuccess }: DepartmentDialogProps) {
  const isEditing = Boolean(department?._id);
  const form = useForm<DepartmentValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: EMPTY_DEPARTMENT,
  });
  const {
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  // Load the department (or blanks) each time the dialog opens
  useEffect(() => {
    if (open) reset(toFormValues(department));
  }, [open, department, reset]);

  async function onSubmit(values: DepartmentValues) {
    const res = await fetch(isEditing ? `/api/v1/departments/${department?._id}` : "/api/v1/departments", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError("root", { message: data.error ?? "Couldn't save the department. Please try again." });
      return;
    }
    toast.success(isEditing ? `Saved ${values.name}` : `Created ${values.name}`);
    notifyConflicts(data.conflicts);
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit department" : "New department"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Hours, days off and holidays for ${department?.name}.`
              : "A government office that citizens book tokens for."}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
            {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
            <DepartmentForm disabled={isSubmitting} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isEditing ? "Save changes" : "Create department"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
