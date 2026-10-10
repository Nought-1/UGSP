"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DepartmentValues } from "@/lib/validators";
import { HolidayManager } from "./holiday-manager";
import { TimezoneSelect } from "./timezone-select";
import { WeekOffPicker } from "./week-off-picker";

export const EMPTY_DEPARTMENT: DepartmentValues = {
  name: "",
  code: "",
  city: "",
  address: "",
  workingHours: { start: "09:00", end: "17:00" },
  weekOffDays: [0, 6],
  timezone: "Asia/Kolkata",
  holidays: [],
  isActive: true,
};

// "8h 30m" between opening and closing; null when the range is invalid
function openWindow(start = "", end = "") {
  const minutes = (hm: string) => {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  };
  const diff = minutes(end) - minutes(start);
  if (!(diff > 0)) return null;
  return `${Math.floor(diff / 60)}h${diff % 60 ? ` ${diff % 60}m` : ""}`;
}

// Fields of the department dialog; the form state lives in the dialog (react-hook-form context)
export function DepartmentForm({ disabled = false }: { disabled?: boolean }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<DepartmentValues>();
  const hours = useWatch({ control, name: "workingHours" });
  const holidays = useWatch({ control, name: "holidays" });
  const openFor = openWindow(hours?.start, hours?.end);

  return (
    <Tabs defaultValue="general">
      <TabsList className="mb-4">
        <TabsTrigger value="general">Details & hours</TabsTrigger>
        <TabsTrigger value="holidays">Holidays ({holidays?.length ?? 0})</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field className="sm:col-span-2" data-invalid={!!errors.name}>
              <FieldLabel htmlFor="dept-name">Department name</FieldLabel>
              <Input
                id="dept-name"
                placeholder="RTO Ahmedabad"
                disabled={disabled}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.code}>
              <FieldLabel htmlFor="dept-code">Code</FieldLabel>
              <Input
                id="dept-code"
                placeholder="RTO-AHM"
                className="uppercase"
                disabled={disabled}
                aria-invalid={!!errors.code}
                {...register("code")}
              />
              <FieldError errors={[errors.code]} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={!!errors.city}>
              <FieldLabel htmlFor="dept-city">City</FieldLabel>
              <Input id="dept-city" placeholder="Ahmedabad" disabled={disabled} {...register("city")} />
              <FieldError errors={[errors.city]} />
            </Field>
            <Field className="sm:col-span-2" data-invalid={!!errors.address}>
              <FieldLabel htmlFor="dept-address">Address</FieldLabel>
              <Input
                id="dept-address"
                placeholder="Subhash Bridge, Ashram Road"
                disabled={disabled}
                {...register("address")}
              />
              <FieldError errors={[errors.address]} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={!!errors.workingHours?.start}>
              <FieldLabel htmlFor="time-start">Opens</FieldLabel>
              <Input id="time-start" type="time" disabled={disabled} {...register("workingHours.start")} />
              <FieldError errors={[errors.workingHours?.start]} />
            </Field>
            <Field data-invalid={!!errors.workingHours?.end}>
              <FieldLabel htmlFor="time-end">Closes</FieldLabel>
              <Input id="time-end" type="time" disabled={disabled} {...register("workingHours.end")} />
              <FieldError errors={[errors.workingHours?.end]} />
              {openFor && !errors.workingHours && <FieldDescription>Open {openFor} each working day</FieldDescription>}
            </Field>
            <Field data-invalid={!!errors.timezone}>
              <FieldLabel>Time zone</FieldLabel>
              <Controller
                control={control}
                name="timezone"
                render={({ field }) => (
                  <TimezoneSelect value={field.value} onChange={field.onChange} disabled={disabled} />
                )}
              />
              <FieldError errors={[errors.timezone]} />
            </Field>
          </div>

          <Field data-invalid={!!errors.weekOffDays}>
            <FieldLabel>Weekly days off</FieldLabel>
            <Controller
              control={control}
              name="weekOffDays"
              render={({ field }) => (
                <WeekOffPicker value={field.value} onChange={field.onChange} disabled={disabled} />
              )}
            />
            <FieldError errors={[errors.weekOffDays]} />
          </Field>

          <Field orientation="horizontal">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch id="dept-active" checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
              )}
            />
            <FieldContent>
              <FieldLabel htmlFor="dept-active">Open for booking</FieldLabel>
              <FieldDescription>
                When off, citizens can&apos;t book this department&apos;s services and its queues stop.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
      </TabsContent>

      <TabsContent value="holidays" className="flex flex-col gap-3">
        <Controller
          control={control}
          name="holidays"
          render={({ field }) => (
            <HolidayManager holidays={field.value} onChange={field.onChange} disabled={disabled} />
          )}
        />
        <FieldError errors={[errors.holidays]} />
      </TabsContent>
    </Tabs>
  );
}
