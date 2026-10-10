"use client";

import { useEffect, useState } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { MultiSelect } from "@/components/multi-select";
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
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { employeeSchema, type EmployeeValues } from "@/lib/validators";

export type StaffRole = EmployeeValues["role"];

// What the dialog needs from a staff row of GET /api/v1/employees
export interface EditableEmployee {
  _id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  counterNumber: number | null;
  departmentId: string;
  department: { _id: string; name: string; code: string } | null;
  serviceIds: string[];
}

export interface DepartmentOption {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface ServiceRow {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface Choice {
  value: string;
  label: string;
}

// Base UI's Select shows the raw value unless it is given the labels
export const ROLE_LABELS: Record<StaffRole, string> = { OFFICER: "Officer", ADMIN: "Admin" };

const ROLE_HINTS: Record<StaffRole, string> = {
  OFFICER: "Calls and serves the tokens of their services.",
  ADMIN: "Manages departments, services and staff. Not counted as queue capacity.",
};

// Editing has the same fields, but the password stays hidden and empty (Reset password changes it)
const createResolver = zodResolver(employeeSchema);
const editResolver = zodResolver(employeeSchema.extend({ password: z.string() }));

const EMPTY_EMPLOYEE: EmployeeValues = {
  name: "",
  email: "",
  password: "",
  role: "OFFICER",
  departmentId: "",
  serviceIds: [],
  counterNumber: null,
  isActive: true,
};

function toFormValues(employee: EditableEmployee): EmployeeValues {
  return {
    name: employee.name,
    email: employee.email,
    password: "",
    role: employee.role,
    departmentId: employee.departmentId,
    serviceIds: [...employee.serviceIds],
    counterNumber: employee.counterNumber,
    isActive: employee.isActive,
  };
}

// Open departments, plus the employee's own one if it was deactivated since, so the field still shows it
function departmentChoices(departments: DepartmentOption[], employee: EditableEmployee | null): Choice[] {
  const choices = departments.filter((d) => d.isActive).map((d) => ({ value: d._id, label: d.name }));
  if (employee && !choices.some((choice) => choice.value === employee.departmentId)) {
    const own = departments.find((d) => d._id === employee.departmentId);
    choices.push({
      value: employee.departmentId,
      label: own ? `${own.name} (inactive)` : (employee.department?.name ?? "Current department"),
    });
  }
  return choices;
}

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EditableEmployee | null; // empty: add a new staff member
  departments: DepartmentOption[]; // every department; the form offers the open ones
  defaultDepartmentId?: string; // preselected when adding (e.g. the page's department filter)
  onSuccess: () => void;
}

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  departments,
  defaultDepartmentId,
  onSuccess,
}: EmployeeDialogProps) {
  const [busy, setBusy] = useState(false); // a save is in flight: keep the dialog open

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit staff member" : "New staff member"}</DialogTitle>
          <DialogDescription>
            {employee
              ? `Profile, role and assignment for ${employee.name}. Use Reset password to change their password.`
              : "A sign-in for an officer or admin. Share the initial password with them."}
          </DialogDescription>
        </DialogHeader>

        {/* DialogContent is only mounted while the dialog is open (and closing), so useForm starts fresh on
            every open; the key also starts it fresh when the dialog switches between staff members. */}
        <EmployeeForm
          key={employee?._id ?? "new"}
          employee={employee ?? null}
          departments={departments}
          defaultDepartmentId={defaultDepartmentId}
          onBusyChange={setBusy}
          onCancel={() => onOpenChange(false)}
          onSaved={() => {
            onOpenChange(false);
            onSuccess();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface EmployeeFormProps {
  employee: EditableEmployee | null;
  departments: DepartmentOption[];
  defaultDepartmentId?: string;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
}

function EmployeeForm({
  employee,
  departments,
  defaultDepartmentId,
  onBusyChange,
  onCancel,
  onSaved,
}: EmployeeFormProps) {
  const choices = departmentChoices(departments, employee);
  const form = useForm<EmployeeValues>({
    resolver: employee ? editResolver : createResolver,
    defaultValues: employee
      ? toFormValues(employee)
      : {
          ...EMPTY_EMPLOYEE,
          departmentId:
            defaultDepartmentId && choices.some((choice) => choice.value === defaultDepartmentId)
              ? defaultDepartmentId
              : "",
        },
  });
  const {
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: EmployeeValues) {
    onBusyChange(true);
    try {
      // An edit leaves the password (Reset password) and the active flag (the table's switch) alone
      const body = employee
        ? {
            name: values.name,
            email: values.email,
            role: values.role,
            departmentId: values.departmentId,
            serviceIds: values.serviceIds,
            counterNumber: values.counterNumber,
          }
        : values;
      const res = await fetch(employee ? `/api/v1/employees/${employee._id}` : "/api/v1/employees", {
        method: employee ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("root", { message: data.error ?? "Couldn't save the staff member. Please try again." });
        return;
      }
      toast.success(employee ? `Saved ${values.name}` : `Created ${values.name}`);
      notifyConflicts(data.conflicts);
      onSaved();
    } catch {
      setError("root", { message: "Couldn't reach the server. Please try again." });
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <EmployeeFields isEditing={employee !== null} departments={choices} disabled={isSubmitting} />
        {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {employee ? "Save changes" : "Create staff member"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

// Fields of the staff dialog; the form state lives in EmployeeForm (react-hook-form context)
function EmployeeFields({
  isEditing,
  departments,
  disabled,
}: {
  isEditing: boolean;
  departments: Choice[];
  disabled: boolean;
}) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<EmployeeValues>();
  const [showPassword, setShowPassword] = useState(false);
  const role = useWatch({ control, name: "role" });
  const departmentId = useWatch({ control, name: "departmentId" });
  const services = useDepartmentServices(departmentId);

  const departmentLabels = Object.fromEntries(departments.map((choice) => [choice.value, choice.label]));
  const serviceOptions = services.list.map((service) => ({
    value: service._id,
    label: service.isActive ? service.name : `${service.name} (inactive)`,
  }));

  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="employee-name">Full name</FieldLabel>
        <Input
          id="employee-name"
          placeholder="Priya Shah"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        <FieldError errors={[errors.name]} />
      </Field>

      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="employee-email">Email</FieldLabel>
        <Input
          id="employee-email"
          type="email"
          placeholder="priya.shah@example.gov.in"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        <FieldError errors={[errors.email]} />
      </Field>

      {!isEditing && (
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="employee-password">Initial password</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="employee-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              disabled={disabled}
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((shown) => !shown)}
                disabled={disabled}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>At least 8 characters. They can change it after signing in.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
      )}

      <Field data-invalid={!!errors.role}>
        <FieldLabel htmlFor="employee-role">Role</FieldLabel>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select
              items={ROLE_LABELS}
              value={field.value}
              onValueChange={(value) => value && field.onChange(value)}
              disabled={disabled}
            >
              <SelectTrigger id="employee-role" className="w-full" aria-invalid={!!errors.role}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldDescription>{ROLE_HINTS[role]}</FieldDescription>
        <FieldError errors={[errors.role]} />
      </Field>

      <Field data-invalid={!!errors.departmentId}>
        <FieldLabel htmlFor="employee-department">Department</FieldLabel>
        <Controller
          control={control}
          name="departmentId"
          render={({ field }) => (
            <Select
              items={departmentLabels}
              value={field.value || null}
              onValueChange={(value) => {
                if (!value || value === field.value) return;
                field.onChange(value);
                setValue("serviceIds", [], { shouldDirty: true }); // services belong to one department
              }}
              disabled={disabled || departments.length === 0}
            >
              <SelectTrigger id="employee-department" className="w-full" aria-invalid={!!errors.departmentId}>
                <SelectValue placeholder="Pick a department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {departments.length === 0 && (
          <FieldDescription>No open departments yet. Add one under Departments first.</FieldDescription>
        )}
        <FieldError
          errors={[errors.departmentId && { message: departmentId ? errors.departmentId.message : "Pick a department" }]}
        />
      </Field>

      <Field data-invalid={!!errors.counterNumber}>
        <FieldLabel htmlFor="employee-counter">Counter number</FieldLabel>
        <Input
          id="employee-counter"
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          step={1}
          placeholder="No counter"
          className="tabular-nums"
          disabled={disabled}
          aria-invalid={!!errors.counterNumber}
          {...register("counterNumber", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
        />
        <FieldDescription>The desk citizens are called to, 1 to 99. Leave empty for none.</FieldDescription>
        <FieldError errors={[errors.counterNumber]} />
      </Field>

      <Field className="sm:col-span-2" data-invalid={!!errors.serviceIds}>
        <FieldLabel htmlFor="employee-services">Services</FieldLabel>
        <Controller
          control={control}
          name="serviceIds"
          render={({ field }) => (
            <MultiSelect
              id="employee-services"
              options={serviceOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder={
                !departmentId ? "Pick a department first" : services.loading ? "Loading services…" : "Search services…"
              }
              emptyText="No services in this department"
              disabled={disabled || !departmentId || services.loading}
              invalid={!!errors.serviceIds}
            />
          )}
        />
        {services.error ? (
          <FieldError>
            {services.error}.{" "}
            <button type="button" className="font-semibold underline underline-offset-4" onClick={services.retry}>
              Try again
            </button>
          </FieldError>
        ) : (
          <FieldDescription>
            {role === "OFFICER"
              ? "The queues this officer serves. Only services of the selected department."
              : "Optional for admins: only officers count toward a queue's capacity."}
          </FieldDescription>
        )}
        <FieldError errors={[errors.serviceIds]} />
      </Field>

      {!isEditing && (
        <Field orientation="horizontal" className="sm:col-span-2">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch id="employee-active" checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
            )}
          />
          <FieldContent>
            <FieldLabel htmlFor="employee-active">Active</FieldLabel>
            <FieldDescription>When off, they can&apos;t sign in until you turn the account on.</FieldDescription>
          </FieldContent>
        </Field>
      )}
    </div>
  );
}

const SERVICES_FAILED = "Couldn't load this department's services";

// The department's services, inactive ones too so assigned ones still show as chips; refetched when it changes
function useDepartmentServices(departmentId: string) {
  const [attempt, setAttempt] = useState(0); // bump to retry
  const [result, setResult] = useState<{ key: string; list: ServiceRow[]; error: string | null } | null>(null);
  const key = `${departmentId}#${attempt}`;

  useEffect(() => {
    if (!departmentId) return;
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({ departmentId, includeInactive: "true" });
        const res = await fetch(`/api/v1/services?${params}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setResult(
          res.ok
            ? { key, list: data.services ?? [], error: null }
            : { key, list: [], error: data.error ?? SERVICES_FAILED }
        );
      } catch {
        if (!cancelled) setResult({ key, list: [], error: SERVICES_FAILED });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [departmentId, key]);

  // A result for another department (or an older attempt) counts as still loading
  const current = departmentId && result?.key === key ? result : null;
  return {
    list: current?.list ?? [],
    loading: Boolean(departmentId) && current === null,
    error: current?.error ?? null,
    retry: () => setAttempt((n) => n + 1),
  };
}
