"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CalendarDays,
  Edit2,
  KeyRound,
  MoreHorizontal,
  RefreshCw,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { notifyConflicts } from "@/components/queue/notify-conflicts";
import {
  EmployeeDialog,
  ROLE_LABELS,
  type DepartmentOption,
  type EditableEmployee,
} from "@/components/employees/employee-dialog";
import { ResetPasswordDialog } from "@/components/employees/reset-password-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface EmployeeRecord extends EditableEmployee {
  services: { _id: string; name: string; code: string; isActive: boolean }[];
  upcomingLeaves: { from: string; to: string; reason?: string }[]; // YYYY-MM-DD, from today on
  createdAt: string;
}

const ALL = "ALL"; // filter value: no filter
type RoleFilter = typeof ALL | EditableEmployee["role"];

// Base UI's Select shows the raw value unless it is given the labels
const ROLE_FILTERS: Record<RoleFilter, string> = {
  ALL: "All roles",
  ADMIN: "Admins",
  OFFICER: "Officers",
};

const JSON_HEADERS = { "Content-Type": "application/json" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "12 Oct", "12–14 Oct", "30 Oct – 2 Nov". Reads the YYYY-MM-DD parts: new Date("YYYY-MM-DD") is UTC
// midnight, which is still the previous day in time zones west of UTC.
function formatLeaveRange(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const month = (m: number) => MONTHS[m - 1] ?? "";
  if (from === to) return `${fromDay} ${month(fromMonth)}`;
  if (fromYear !== toYear) return `${fromDay} ${month(fromMonth)} ${fromYear} – ${toDay} ${month(toMonth)} ${toYear}`;
  if (fromMonth !== toMonth) return `${fromDay} ${month(fromMonth)} – ${toDay} ${month(toMonth)}`;
  return `${fromDay}–${toDay} ${month(fromMonth)}`;
}

// What deactivating someone does, for the confirm dialog
function deactivationNote(employee: EmployeeRecord) {
  const access = `${employee.name} can't sign in or use the backoffice until you turn the account back on.`;
  return employee.role === "OFFICER"
    ? `${access} Their services lose this officer's capacity; tokens already booked are kept.`
    : access;
}

function RolePill({ role }: { role: EmployeeRecord["role"] }) {
  return (
    <span className={cn("stamp", role === "ADMIN" ? "border-ink bg-ink text-cream" : "border-ink text-ink")}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function CounterBadge({ counter }: { counter: number | null }) {
  if (counter == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className="inline-flex bg-muted px-2 py-0.5 font-heading text-sm font-semibold tracking-wide tabular-nums"
      title={`Counter ${counter}`}
    >
      C-{String(counter).padStart(2, "0")}
    </span>
  );
}

// The first two services as chips, then "+N" (the rest in the tooltip)
function ServiceChips({ services }: { services: EmployeeRecord["services"] }) {
  if (services.length === 0) return <span className="text-muted-foreground">—</span>;
  const rest = services.slice(2);
  return (
    <div className="flex items-center gap-1">
      {services.slice(0, 2).map((service) => (
        <span
          key={service._id}
          title={service.isActive ? service.name : `${service.name} (inactive)`}
          className={cn(
            "max-w-36 truncate border px-1.5 py-0.5 text-xs font-medium",
            service.isActive ? "border-transparent bg-muted" : "border-dashed text-muted-foreground"
          )}
        >
          {service.name}
        </span>
      ))}
      {rest.length > 0 && (
        <span
          className="px-1 text-xs font-semibold text-muted-foreground tabular-nums"
          title={rest.map((service) => service.name).join(", ")}
        >
          +{rest.length}
        </span>
      )}
    </div>
  );
}

// The next leave range, then "+N more" (the rest in the tooltip)
function LeaveSummary({ leaves }: { leaves: EmployeeRecord["upcomingLeaves"] }) {
  const [next, ...later] = leaves;
  if (!next) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex items-center gap-1.5 font-medium tabular-nums" title={next.reason || undefined}>
        <CalendarDays className="size-3.5 text-muted-foreground" />
        {formatLeaveRange(next.from, next.to)}
      </span>
      {later.length > 0 && (
        <span
          className="text-muted-foreground"
          title={later.map((leave) => formatLeaveRange(leave.from, leave.to)).join(", ")}
        >
          +{later.length} more
        </span>
      )}
    </div>
  );
}

export default function EmployeesPage() {
  const currentUserId = useSession().data?.user.id;
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>(ALL);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  // The targets stay set after a dialog closes, so its text holds while it animates out
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState<EmployeeRecord | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<EmployeeRecord | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0); // bump to reload the list

  // Departments for the filter and the dialog; inactive ones too, as staff can still belong to them
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/departments?includeInactive=true");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't load departments");
        if (!cancelled) setDepartments(data.departments ?? []);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Couldn't load departments");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Staff, filtered on the server
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams();
        if (departmentFilter !== ALL) params.set("departmentId", departmentFilter);
        if (roleFilter !== ALL) params.set("role", roleFilter);
        const query = params.toString();
        const res = await fetch(`/api/v1/employees${query ? `?${query}` : ""}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't load staff");
        if (!cancelled) {
          setEmployees(data.employees ?? []);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Couldn't load staff";
          setEmployees([]); // don't leave the previous filter's rows under the new one
          setLoadError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [departmentFilter, roleFilter, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const refresh = () => {
    setLoading(true);
    reload();
  };

  // The filters run on the server, so changing one reloads the list
  function filterBy(department: string, role: RoleFilter) {
    if (department === departmentFilter && role === roleFilter) return;
    setDepartmentFilter(department);
    setRoleFilter(role);
    setLoading(true);
  }

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (employee: EmployeeRecord) => {
    setEditing(employee);
    setDialogOpen(true);
  };

  const openReset = (employee: EmployeeRecord) => {
    setResetting(employee);
    setResetOpen(true);
  };

  // Swap in the row the API sent back, or just flip the flag if it sent none
  const updateRow = (id: string, row: EmployeeRecord | undefined, isActive: boolean) =>
    setEmployees((prev) => prev.map((e) => (e._id === id ? (row ?? { ...e, isActive }) : e)));

  async function activate(employee: EmployeeRecord) {
    setActivatingId(employee._id);
    try {
      const res = await fetch(`/api/v1/employees/${employee._id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? `Couldn't activate ${employee.name}`);
        return;
      }
      updateRow(employee._id, data.employee, true);
      toast.success(`${employee.name} can sign in again`);
      notifyConflicts(data.conflicts);
    } catch {
      toast.error(`Couldn't activate ${employee.name}`);
    } finally {
      setActivatingId(null);
    }
  }

  // Deactivation goes through the confirm dialog; errors are thrown so the dialog shows them
  async function deactivate() {
    if (!deactivating) return;
    const res = await fetch(`/api/v1/employees/${deactivating._id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ isActive: false }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Couldn't deactivate ${deactivating.name}`);
    updateRow(deactivating._id, data.employee, false);
    toast.success(`${deactivating.name} deactivated`);
    notifyConflicts(data.conflicts);
  }

  function setActive(employee: EmployeeRecord, next: boolean) {
    if (next) {
      activate(employee);
      return;
    }
    setDeactivating(employee);
    setConfirmOpen(true);
  }

  const activeCount = employees.filter((e) => e.isActive).length;
  const filtersOn = departmentFilter !== ALL || roleFilter !== ALL;
  const departmentFilters: Record<string, string> = {
    [ALL]: "All departments",
    ...Object.fromEntries(departments.map((d) => [d._id, d.isActive ? d.name : `${d.name} (inactive)`])),
  };

  return (
    <>
      <PageHeader
        className="reveal"
        kicker="Configuration"
        title="Staff"
        description="Officers and admins who sign in to the backoffice: department, services, counter and leave."
        actions={
          <>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              Refresh
            </Button>
            <Button onClick={openCreate}>
              <UserPlus />
              New staff member
            </Button>
          </>
        }
      />

      <div className="reveal flex flex-col gap-3 bg-card p-3 shadow-sm ring-1 ring-foreground/5 [--i:1] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Select
            items={departmentFilters}
            value={departmentFilter}
            onValueChange={(value) => filterBy(value ?? ALL, roleFilter)}
          >
            <SelectTrigger className="w-full sm:w-60" aria-label="Filter by department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(departmentFilters).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={ROLE_FILTERS}
            value={roleFilter}
            onValueChange={(value) => filterBy(departmentFilter, value ?? ALL)}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_FILTERS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="micro-label whitespace-nowrap tabular-nums">
          {employees.length} staff · {activeCount} active
        </span>
      </div>

      <div className="reveal overflow-hidden bg-card shadow-sm ring-1 ring-foreground/5 [--i:2]">
        {loading && employees.length === 0 ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
            <AlertCircle className="size-10 text-destructive" />
            <h3 className="font-heading text-lg font-semibold uppercase">Couldn&apos;t load staff</h3>
            <p className="max-w-sm text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={refresh}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
            <UsersRound className="size-10 text-muted-foreground/40" />
            <h3 className="font-heading text-lg font-semibold uppercase">No staff found</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              {filtersOn
                ? "Nobody matches these filters."
                : "Add the officers who serve the queues, and any other admins."}
            </p>
            {filtersOn ? (
              <Button variant="outline" size="sm" className="mt-2" onClick={() => filterBy(ALL, ALL)}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" className="mt-2" onClick={openCreate}>
                <UserPlus />
                New staff member
              </Button>
            )}
          </div>
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")} aria-busy={loading}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Counter</TableHead>
                  <TableHead>Upcoming leave</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const isSelf = employee._id === currentUserId;
                  const lockedOn = isSelf && employee.isActive; // the API refuses self-deactivation
                  return (
                    <TableRow key={employee._id} className={employee.isActive ? undefined : "opacity-70"}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-2 font-semibold">
                            {employee.name}
                            {isSelf && <span className="micro-label">You</span>}
                          </span>
                          <span className="text-xs text-muted-foreground">{employee.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RolePill role={employee.role} />
                      </TableCell>
                      <TableCell>
                        {employee.department ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{employee.department.name}</span>
                            <span className="text-xs text-muted-foreground">{employee.department.code}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ServiceChips services={employee.services} />
                      </TableCell>
                      <TableCell>
                        <CounterBadge counter={employee.counterNumber} />
                      </TableCell>
                      <TableCell>
                        <LeaveSummary leaves={employee.upcomingLeaves} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={employee.isActive}
                            onCheckedChange={(checked) => setActive(employee, checked)}
                            disabled={lockedOn || activatingId === employee._id}
                            title={lockedOn ? "You can't deactivate your own account" : undefined}
                            aria-label={employee.isActive ? `Deactivate ${employee.name}` : `Activate ${employee.name}`}
                          />
                          {employee.isActive ? (
                            <span className="stamp border-status-done-border bg-status-done-bg text-status-done">
                              Active
                            </span>
                          ) : (
                            <span className="stamp border-border text-muted-foreground">Inactive</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" aria-label={`Actions for ${employee.name}`} />}
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => openEdit(employee)}>
                              <Edit2 />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openReset(employee)}>
                              <KeyRound />
                              Reset password
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        departments={departments}
        defaultDepartmentId={departmentFilter !== ALL ? departmentFilter : undefined}
        onSuccess={reload}
      />

      <ResetPasswordDialog open={resetOpen} onOpenChange={setResetOpen} employee={resetting} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Deactivate staff member?"
        description={deactivating ? deactivationNote(deactivating) : undefined}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={deactivate}
      />
    </>
  );
}
