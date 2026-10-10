"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MultiSelect, type PickOption } from "@/components/multi-select";
import { notifyConflicts } from "@/components/queue/notify-conflicts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { serviceSchema, type ServiceValues } from "@/lib/validators";

export interface DepartmentOption {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  workingHours: { start: string; end: string };
}

// What the dialog needs from a service row
export interface EditableService {
  _id: string;
  departmentId: string;
  name: string;
  code: string;
  description?: string;
  avgServiceMinutes: number;
  cutoffTime: string;
  dailyTokenLimit: number;
  bookingWindowDays: number;
  alertLeadMinutes: number;
  isActive: boolean;
  officers: { _id: string }[];
}

interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: EditableService | null; // null: create
  departments: DepartmentOption[];
  defaultDepartmentId?: string; // pre-picked for a new service (the page's department filter)
  onSuccess: () => void;
}

const EMPTY_SERVICE: ServiceValues = {
  departmentId: "",
  name: "",
  code: "",
  description: "",
  avgServiceMinutes: 10,
  cutoffTime: "16:00",
  dailyTokenLimit: 50,
  bookingWindowDays: 7,
  alertLeadMinutes: 30,
  isActive: true,
  officerIds: [],
};

function toFormValues(service: EditableService | null, defaultDepartmentId = ""): ServiceValues {
  if (!service) return { ...EMPTY_SERVICE, departmentId: defaultDepartmentId };
  return {
    departmentId: service.departmentId,
    name: service.name,
    code: service.code,
    description: service.description ?? "",
    avgServiceMinutes: service.avgServiceMinutes,
    cutoffTime: service.cutoffTime,
    dailyTokenLimit: service.dailyTokenLimit,
    bookingWindowDays: service.bookingWindowDays,
    alertLeadMinutes: service.alertLeadMinutes,
    isActive: service.isActive,
    officerIds: service.officers.map((officer) => officer._id),
  };
}

export function ServiceDialog({
  open,
  onOpenChange,
  service,
  departments,
  defaultDepartmentId,
  onSuccess,
}: ServiceDialogProps) {
  const isEditing = service !== null;
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ServiceValues>({ resolver: zodResolver(serviceSchema), defaultValues: EMPTY_SERVICE });

  // Load the service (or blanks) each time the dialog opens
  useEffect(() => {
    if (open) reset(toFormValues(service, defaultDepartmentId));
  }, [open, service, defaultDepartmentId, reset]);

  // Officers of the picked department; the API keeps a service's officers inside its department
  const departmentId = useWatch({ control, name: "departmentId" });
  const [officers, setOfficers] = useState<PickOption[]>([]);
  useEffect(() => {
    if (!open || !departmentId) return;
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/v1/employees?departmentId=${departmentId}&role=OFFICER`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't load the officers");
        return;
      }
      setOfficers(
        (data.employees as { _id: string; name: string; isActive: boolean; counterNumber: number | null }[]).map(
          (officer) => ({
            value: officer._id,
            label: `${officer.name}${officer.counterNumber ? ` · C-${String(officer.counterNumber).padStart(2, "0")}` : ""}${officer.isActive ? "" : " (inactive)"}`,
          })
        )
      );
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, departmentId]);

  const department = departments.find((d) => d._id === departmentId);
  const departmentItems = Object.fromEntries(departments.map((d) => [d._id, `${d.name} (${d.code})`]));

  async function onSubmit(values: ServiceValues) {
    // PATCH drops departmentId (a service stays in its department), so both send the whole form
    const res = await fetch(isEditing ? `/api/v1/services/${service._id}` : "/api/v1/services", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError("root", { message: data.error ?? "Couldn't save the service. Please try again." });
      return;
    }
    toast.success(isEditing ? `Saved ${values.name}` : `Created ${values.name}`);
    notifyConflicts(data.conflicts);
    onOpenChange(false);
    onSuccess();
  }

  const number = { valueAsNumber: true } as const;

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit service" : "New service"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Timing, limits and officers for ${service.name}. Changes refresh today's and future queues.`
              : "Something citizens book a token for, such as a driving licence test."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
          <FieldGroup>
            <Field data-invalid={!!errors.departmentId}>
              <FieldLabel>Department</FieldLabel>
              <Controller
                control={control}
                name="departmentId"
                render={({ field }) => (
                  <Select
                    items={departmentItems}
                    value={field.value || null}
                    onValueChange={(value) => {
                      field.onChange(value ?? "");
                      setValue("officerIds", []); // officers belong to the department
                    }}
                    disabled={isEditing || isSubmitting}
                  >
                    <SelectTrigger className="w-full" aria-label="Department" aria-invalid={!!errors.departmentId}>
                      <SelectValue placeholder="Pick a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments
                        .filter((d) => d.isActive || d._id === field.value)
                        .map((d) => (
                          <SelectItem key={d._id} value={d._id}>
                            {d.name} ({d.code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {isEditing && <FieldDescription>A service stays in its department.</FieldDescription>}
              <FieldError errors={[errors.departmentId]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field className="sm:col-span-2" data-invalid={!!errors.name}>
                <FieldLabel htmlFor="svc-name">Service name</FieldLabel>
                <Input
                  id="svc-name"
                  placeholder="Driving License"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.code}>
                <FieldLabel htmlFor="svc-code">Code</FieldLabel>
                <Input
                  id="svc-code"
                  placeholder="DL"
                  className="uppercase"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.code}
                  {...register("code")}
                />
                <FieldDescription>Printed on tokens: DL-012</FieldDescription>
                <FieldError errors={[errors.code]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="svc-description">Description</FieldLabel>
              <Textarea
                id="svc-description"
                rows={2}
                placeholder="What citizens should bring, or what happens at the counter"
                disabled={isSubmitting}
                {...register("description")}
              />
              <FieldError errors={[errors.description]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={!!errors.avgServiceMinutes}>
                <FieldLabel htmlFor="svc-avg">Minutes per citizen</FieldLabel>
                <Input
                  id="svc-avg"
                  type="number"
                  min={1}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.avgServiceMinutes}
                  {...register("avgServiceMinutes", number)}
                />
                <FieldError errors={[errors.avgServiceMinutes]} />
              </Field>
              <Field data-invalid={!!errors.cutoffTime}>
                <FieldLabel htmlFor="svc-cutoff">Last token by</FieldLabel>
                <Input
                  id="svc-cutoff"
                  type="time"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.cutoffTime}
                  {...register("cutoffTime")}
                />
                {department && (
                  <FieldDescription>
                    Office hours {department.workingHours.start} – {department.workingHours.end}
                  </FieldDescription>
                )}
                <FieldError errors={[errors.cutoffTime]} />
              </Field>
              <Field data-invalid={!!errors.dailyTokenLimit}>
                <FieldLabel htmlFor="svc-limit">Daily token limit</FieldLabel>
                <Input
                  id="svc-limit"
                  type="number"
                  min={1}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.dailyTokenLimit}
                  {...register("dailyTokenLimit", number)}
                />
                <FieldError errors={[errors.dailyTokenLimit]} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={!!errors.bookingWindowDays}>
                <FieldLabel htmlFor="svc-window">Bookable days ahead</FieldLabel>
                <Input
                  id="svc-window"
                  type="number"
                  min={1}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.bookingWindowDays}
                  {...register("bookingWindowDays", number)}
                />
                <FieldDescription>Including today</FieldDescription>
                <FieldError errors={[errors.bookingWindowDays]} />
              </Field>
              <Field className="sm:col-span-2" data-invalid={!!errors.alertLeadMinutes}>
                <FieldLabel htmlFor="svc-alert">&ldquo;Arrive soon&rdquo; alert, minutes before the turn</FieldLabel>
                <Input
                  id="svc-alert"
                  type="number"
                  min={0}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.alertLeadMinutes}
                  {...register("alertLeadMinutes", number)}
                />
                <FieldDescription>Allow for travel time. 0 alerts at the estimated turn.</FieldDescription>
                <FieldError errors={[errors.alertLeadMinutes]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.officerIds}>
              <FieldLabel htmlFor="svc-officers">Officers</FieldLabel>
              <Controller
                control={control}
                name="officerIds"
                render={({ field }) => (
                  <MultiSelect
                    id="svc-officers"
                    options={departmentId ? officers : []}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={departmentId ? "Search officers" : "Pick a department first"}
                    emptyText="No officers in this department"
                    disabled={!departmentId || isSubmitting}
                    invalid={!!errors.officerIds}
                  />
                )}
              />
              <FieldDescription>Capacity counts the officers who are active and not on leave that day.</FieldDescription>
              <FieldError errors={[errors.officerIds]} />
            </Field>

            <Field orientation="horizontal">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="svc-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
              <FieldContent>
                <FieldLabel htmlFor="svc-active">Open for booking</FieldLabel>
                <FieldDescription>When off, citizens can&apos;t book it. Booked tokens are kept.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isEditing ? "Save changes" : "Create service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
