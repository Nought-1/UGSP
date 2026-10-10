"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { dayCount, dayOfMonth, monthLabel, monthShort, rangeLabel } from "@/components/leaves/dates";
import { LeaveDialog, type StaffOption } from "@/components/leaves/leave-dialog";
import { notifyConflicts } from "@/components/queue/notify-conflicts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaveRecord {
  employeeId: string;
  employeeName: string;
  role: "ADMIN" | "OFFICER";
  isActive: boolean;
  department: { _id: string; name: string; code: string } | null;
  services: { _id: string; name: string; code: string }[];
  from: string;
  to: string;
  reason: string;
}

const ALL = "ALL";

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [staff, setStaff] = useState<(StaffOption & { isActive: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState(ALL);
  const [fromFilter, setFromFilter] = useState(""); // empty: from today
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removing, setRemoving] = useState<LeaveRecord | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bump to reload

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/v1/departments?includeInactive=true");
      const data = await res.json().catch(() => ({}));
      if (!cancelled && res.ok) setDepartments(data.departments ?? []);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const params = new URLSearchParams();
      if (departmentFilter !== ALL) params.set("departmentId", departmentFilter);
      if (fromFilter) params.set("from", fromFilter);
      try {
        // Staff too: the add dialog picks from them and greys out their existing leave
        const [leaveRes, staffRes] = await Promise.all([
          fetch(`/api/v1/leaves?${params}`, { cache: "no-store" }),
          fetch("/api/v1/employees", { cache: "no-store" }),
        ]);
        const [leaveData, staffData] = await Promise.all([leaveRes.json(), staffRes.json()]);
        if (!leaveRes.ok) throw new Error(leaveData.error ?? "Couldn't load leave");
        if (!staffRes.ok) throw new Error(staffData.error ?? "Couldn't load staff");
        if (!cancelled) {
          setLeaves(leaveData.leaves ?? []);
          setStaff(staffData.employees ?? []);
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Couldn't load leave");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [departmentFilter, fromFilter, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const refresh = () => {
    setLoading(true);
    reload();
  };

  async function remove() {
    if (!removing) return;
    const res = await fetch(`/api/v1/employees/${removing.employeeId}/leaves?from=${removing.from}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Couldn't remove the leave");
    toast.success(`Removed ${removing.employeeName}'s leave on ${rangeLabel(removing.from, removing.to)}`);
    notifyConflicts(data.conflicts);
    reload();
  }

  const departmentItems: Record<string, string> = {
    [ALL]: "All departments",
    ...Object.fromEntries(departments.map((d) => [d._id, d.name])),
  };

  // Grouped by the month the leave starts in (the API sorts by start date)
  const months: { label: string; rows: LeaveRecord[] }[] = [];
  for (const leave of leaves) {
    const label = monthLabel(leave.from);
    if (months.at(-1)?.label !== label) months.push({ label, rows: [] });
    months.at(-1)?.rows.push(leave);
  }

  return (
    <>
      <PageHeader
        className="reveal"
        kicker="Configuration"
        title="Leave"
        description="Staff on leave don't count towards capacity on those days, so fewer tokens can be booked."
        actions={
          <>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              Refresh
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus />
              Add leave
            </Button>
          </>
        }
      />

      <div className="reveal flex flex-col gap-3 bg-card p-3 shadow-sm ring-1 ring-foreground/5 [--i:1] sm:flex-row sm:items-center sm:justify-between">
        <Select
          items={departmentItems}
          value={departmentFilter}
          onValueChange={(value) => {
            setLoading(true);
            setDepartmentFilter(value ?? ALL);
          }}
        >
          <SelectTrigger className="w-full sm:w-64" aria-label="Filter by department">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(departmentItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <Label htmlFor="leave-from" className="micro-label whitespace-nowrap">
            Ending on or after
          </Label>
          <Input
            id="leave-from"
            type="date"
            value={fromFilter}
            onChange={(e) => {
              setLoading(true);
              setFromFilter(e.target.value);
            }}
            className="w-40"
          />
          {fromFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoading(true);
                setFromFilter("");
              }}
            >
              Today
            </Button>
          )}
        </div>
      </div>

      <div className="reveal flex flex-col gap-6 [--i:2]">
        {loading && leaves.length === 0 ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : leaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 bg-card p-12 text-center shadow-sm ring-1 ring-foreground/5">
            <CalendarDays className="size-10 text-muted-foreground/40" />
            <h3 className="font-heading text-lg font-semibold uppercase">No upcoming leave</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Everyone is available{fromFilter ? ` from ${fromFilter}` : ""}. Add leave so capacity follows who is in.
            </p>
            <Button size="sm" className="mt-2" onClick={() => setDialogOpen(true)}>
              <Plus />
              Add leave
            </Button>
          </div>
        ) : (
          months.map((month) => (
            <section key={month.label} className="flex flex-col gap-2">
              <h2 className="micro-label">{month.label}</h2>
              {month.rows.map((leave) => {
                const days = dayCount(leave.from, leave.to);
                const sameMonth = leave.from.slice(0, 7) === leave.to.slice(0, 7);
                return (
                  <article
                    key={`${leave.employeeId}-${leave.from}`}
                    className="flex items-stretch bg-card shadow-sm ring-1 ring-foreground/5"
                  >
                    <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-0.5 bg-ink px-2 py-3 text-cream sm:w-28">
                      <span className="font-heading text-2xl leading-none font-semibold tabular-nums">
                        {leave.from === leave.to
                          ? dayOfMonth(leave.from)
                          : `${dayOfMonth(leave.from)}–${dayOfMonth(leave.to)}`}
                      </span>
                      <span className="font-heading text-xs tracking-[0.18em] uppercase">
                        {sameMonth ? monthShort(leave.from) : `${monthShort(leave.from)}–${monthShort(leave.to)}`}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{leave.employeeName}</span>
                        {leave.role === "ADMIN" && (
                          <span className="stamp border-ink text-ink">Admin</span>
                        )}
                        {!leave.isActive && <span className="stamp border-border text-muted-foreground">Inactive</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {leave.department?.name ?? "No department"}
                        {leave.reason && <> · {leave.reason}</>}
                      </p>
                      {leave.services.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {leave.services.map((service) => (
                            <span
                              key={service._id}
                              className="bg-muted px-1.5 py-0.5 font-heading text-[11px] tracking-wide"
                              title={service.name}
                            >
                              {service.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end justify-between gap-2 p-3 sm:p-4">
                      <span className="micro-label tabular-nums">
                        {days} day{days === 1 ? "" : "s"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoving(leave)}
                        aria-label={`Remove ${leave.employeeName}'s leave on ${rangeLabel(leave.from, leave.to)}`}
                      >
                        <Trash2 />
                        Remove
                      </Button>
                    </div>
                  </article>
                );
              })}
            </section>
          ))
        )}
      </div>

      <LeaveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        staff={staff.filter((s) => s.isActive)}
        onSuccess={reload}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove this leave?"
        description={
          removing &&
          `${removing.employeeName} will count as available on ${rangeLabel(removing.from, removing.to)} again, so those days can take more bookings.`
        }
        confirmLabel="Remove leave"
        variant="danger"
        onConfirm={remove}
      />
    </>
  );
}
