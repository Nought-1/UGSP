"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PickOption } from "@/components/multi-select";
import { notifyConflicts } from "@/components/queue/notify-conflicts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { leaveFormSchema, type LeaveFormValues } from "@/lib/validators";
import { dayCount, fromYmd, isPastDay, rangeLabel, toYmd } from "./dates";

export interface StaffOption {
  _id: string;
  name: string;
  role: "ADMIN" | "OFFICER";
  department: { name: string } | null;
  upcomingLeaves: { from: string; to: string }[];
}

interface LeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffOption[]; // active staff
  onSuccess: () => void;
}

const EMPTY_LEAVE: LeaveFormValues = { employeeId: "", from: "", to: "", reason: "" };

export function LeaveDialog({ open, onOpenChange, staff, onSuccess }: LeaveDialogProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormValues>({ resolver: zodResolver(leaveFormSchema), defaultValues: EMPTY_LEAVE });

  useEffect(() => {
    if (open) reset(EMPTY_LEAVE);
  }, [open, reset]);

  const [employeeId, from, to] = useWatch({ control, name: ["employeeId", "from", "to"] });
  const options: PickOption[] = staff.map((s) => ({
    value: s._id,
    label: `${s.name}${s.department ? ` · ${s.department.name}` : ""}${s.role === "ADMIN" ? " (admin)" : ""}`,
  }));
  const picked = staff.find((s) => s._id === employeeId);

  async function onSubmit({ employeeId: id, ...leave }: LeaveFormValues) {
    const res = await fetch(`/api/v1/employees/${id}/leaves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leave),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError("root", { message: data.error ?? "Couldn't add the leave. Please try again." });
      return;
    }
    toast.success(`Leave added for ${picked?.name ?? "the staff member"}: ${rangeLabel(leave.from, leave.to)}`);
    notifyConflicts(data.conflicts);
    onOpenChange(false);
    onSuccess();
  }

  const datesError = errors.from || errors.to;

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add leave</DialogTitle>
          <DialogDescription>
            Officers on leave don&apos;t count towards a day&apos;s capacity. Queues on those days update right away.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
          <FieldGroup>
            <Field data-invalid={!!errors.employeeId}>
              <FieldLabel htmlFor="leave-employee">Staff member</FieldLabel>
              <Controller
                control={control}
                name="employeeId"
                render={({ field }) => (
                  <Combobox
                    items={options}
                    value={options.find((option) => option.value === field.value) ?? null}
                    onValueChange={(option) => {
                      field.onChange(option?.value ?? "");
                      setValue("from", ""); // their existing leave changes which days can be picked
                      setValue("to", "");
                    }}
                    itemToStringLabel={(option) => option.label}
                    isItemEqualToValue={(a, b) => a.value === b.value}
                    disabled={isSubmitting}
                  >
                    <ComboboxInput
                      id="leave-employee"
                      placeholder="Search staff"
                      className="w-full"
                      aria-invalid={!!errors.employeeId || undefined}
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No staff found</ComboboxEmpty>
                      <ComboboxList>
                        {(option: PickOption) => (
                          <ComboboxItem key={option.value} value={option}>
                            {option.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                )}
              />
              <FieldError errors={[errors.employeeId]} />
            </Field>

            <Field data-invalid={!!datesError}>
              <FieldLabel>Days</FieldLabel>
              <Calendar
                mode="range"
                selected={from ? { from: fromYmd(from), to: to ? fromYmd(to) : undefined } : undefined}
                onSelect={(range) => {
                  setValue("from", range?.from ? toYmd(range.from) : "", { shouldValidate: !!errors.from });
                  setValue("to", range?.to ? toYmd(range.to) : range?.from ? toYmd(range.from) : "", {
                    shouldValidate: !!errors.to,
                  });
                }}
                disabled={[
                  isPastDay,
                  ...(picked?.upcomingLeaves ?? []).map((leave) => ({ from: fromYmd(leave.from), to: fromYmd(leave.to) })),
                ]}
                excludeDisabled
                className="self-start border border-border"
              />
              <FieldDescription>
                {from && to
                  ? `${rangeLabel(from, to)} · ${dayCount(from, to)} day${dayCount(from, to) === 1 ? "" : "s"}`
                  : "Click the first day, then the last. Days already on leave are greyed out."}
              </FieldDescription>
              {datesError && <FieldError>{from ? datesError.message : "Pick the first and last day of leave"}</FieldError>}
            </Field>

            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="leave-reason">Reason (optional)</FieldLabel>
              <Input id="leave-reason" placeholder="Training, medical, personal…" disabled={isSubmitting} {...register("reason")} />
              <FieldError errors={[errors.reason]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Add leave
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
