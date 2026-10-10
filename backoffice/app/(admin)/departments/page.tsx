"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Clock,
  Edit2,
  Globe,
  Layers,
  MapPin,
  MoreHorizontal,
  Plus,
  Power,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { notifyConflicts } from "@/components/queue/notify-conflicts";
import { DepartmentCardStats } from "@/components/departments/department-card-stats";
import { DepartmentDialog, type EditableDepartment } from "@/components/departments/department-dialog";
import { DAYS_OF_WEEK } from "@/components/departments/week-off-picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DepartmentRecord extends EditableDepartment {
  holidaysCount: number;
  servicesCount: number;
  employeesCount: number;
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

// Base UI's Select shows the raw value unless it is given the labels
const STATUS_FILTERS: Record<StatusFilter, string> = {
  ALL: "All departments",
  ACTIVE: "Open only",
  INACTIVE: "Inactive only",
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [deactivating, setDeactivating] = useState<DepartmentRecord | null>(null);

  const [reloadKey, setReloadKey] = useState(0); // bump to reload the list

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/departments?includeInactive=true");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load departments");
        if (!cancelled) setDepartments(data.departments ?? []);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Couldn't load departments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const refresh = () => {
    setLoading(true);
    reload();
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (dept: DepartmentRecord) => {
    setEditing(dept);
    setDialogOpen(true);
  };

  async function activate(dept: DepartmentRecord) {
    const res = await fetch(`/api/v1/departments/${dept._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't activate the department");
      return;
    }
    setDepartments((prev) => prev.map((d) => (d._id === dept._id ? { ...d, isActive: true } : d)));
    toast.success(`${dept.name} is open for booking`);
    notifyConflicts(data.conflicts);
  }

  // Deactivation goes through the confirm dialog; errors are thrown so the dialog shows them
  async function deactivate() {
    if (!deactivating) return;
    const res = await fetch(`/api/v1/departments/${deactivating._id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Couldn't deactivate the department");
    setDepartments((prev) => prev.map((d) => (d._id === deactivating._id ? { ...d, isActive: false } : d)));
    toast.success(`${deactivating.name} deactivated`);
    notifyConflicts(data.conflicts);
  }

  const setActive = (dept: DepartmentRecord, next: boolean) => (next ? activate(dept) : setDeactivating(dept));

  const query = search.trim().toLowerCase();
  const filtered = departments.filter((dept) => {
    if (statusFilter === "ACTIVE" && !dept.isActive) return false;
    if (statusFilter === "INACTIVE" && dept.isActive) return false;
    if (!query) return true;
    return [dept.name, dept.code, dept.city, dept.address].some((value) => value?.toLowerCase().includes(query));
  });
  const filtersOn = query !== "" || statusFilter !== "ALL";

  return (
    <>
      <PageHeader
        className="reveal"
        kicker="Configuration"
        title="Departments"
        description="Offices, their working hours, weekly days off and public holidays."
        actions={
          <>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              Refresh
            </Button>
            <Button onClick={openCreate}>
              <Plus />
              New department
            </Button>
          </>
        }
      />

      <div className="reveal [--i:1]">
        <DepartmentCardStats departments={departments} />
      </div>

      <div className="reveal flex flex-col gap-3 bg-card p-3 shadow-sm ring-1 ring-foreground/5 [--i:2] sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute top-2.5 left-0 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code or city"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-6"
            aria-label="Search departments"
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <Select
            items={STATUS_FILTERS}
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_FILTERS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="micro-label whitespace-nowrap">
            {filtered.length} of {departments.length}
          </span>
        </div>
      </div>

      <div className="reveal overflow-hidden bg-card shadow-sm ring-1 ring-foreground/5 [--i:3]">
        {loading && departments.length === 0 ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
            <Building2 className="size-10 text-muted-foreground/40" />
            <h3 className="font-heading text-lg font-semibold uppercase">No departments found</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              {filtersOn
                ? "Nothing matches the search or filter."
                : "Add the first department so services and tokens can be set up."}
            </p>
            {filtersOn ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button size="sm" className="mt-2" onClick={openCreate}>
                <Plus />
                New department
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Days off</TableHead>
                  <TableHead>Set up</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((dept) => (
                  <TableRow key={dept._id} className={dept.isActive ? undefined : "opacity-70"}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex shrink-0 bg-ink px-2 py-1 font-heading text-xs font-semibold tracking-wide text-cream">
                          {dept.code}
                        </span>
                        <Link href={`/departments/${dept._id}`} className="font-semibold hover:underline">
                          {dept.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1.5 text-xs">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{dept.city || "—"}</div>
                          {dept.address && (
                            <p className="max-w-40 truncate text-muted-foreground" title={dept.address}>
                              {dept.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="flex items-center gap-1.5 font-medium tabular-nums">
                          <Clock className="size-3.5 text-muted-foreground" />
                          {dept.workingHours.start} – {dept.workingHours.end}
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Globe className="size-3" />
                          {dept.timezone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {dept.weekOffDays.length > 0 ? (
                        <span className="text-xs">
                          {dept.weekOffDays.map((d) => DAYS_OF_WEEK[d]?.label ?? `Day ${d}`).join(", ")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Open all week</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="size-3" />
                          {dept.servicesCount} services
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="size-3" />
                          {dept.employeesCount} staff
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {dept.holidaysCount} holidays
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={dept.isActive}
                          onCheckedChange={(checked) => setActive(dept, checked)}
                          aria-label={dept.isActive ? `Deactivate ${dept.name}` : `Activate ${dept.name}`}
                        />
                        {dept.isActive ? (
                          <span className="stamp border-status-done-border bg-status-done-bg text-status-done">Open</span>
                        ) : (
                          <span className="stamp border-border text-muted-foreground">Inactive</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" aria-label={`Actions for ${dept.name}`} />}
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openEdit(dept)}>
                            <Edit2 />
                            Edit department
                          </DropdownMenuItem>
                          <DropdownMenuItem render={<Link href={`/departments/${dept._id}`} />}>
                            <Calendar />
                            Holidays and details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setActive(dept, !dept.isActive)}
                            className={dept.isActive ? "text-destructive" : undefined}
                          >
                            <Power />
                            {dept.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <DepartmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        department={editing}
        onSuccess={reload}
      />

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Deactivate department?"
        description={`Citizens won't be able to book ${deactivating?.name ?? "this department"}'s services, and its queues stop. Existing tokens are kept.`}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={deactivate}
      />
    </>
  );
}
