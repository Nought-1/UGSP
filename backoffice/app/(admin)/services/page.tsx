"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Edit2, Layers, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { CapacityBar } from "@/components/queue/capacity-bar";
import { notifyConflicts } from "@/components/queue/notify-conflicts";
import { ServiceDialog, type DepartmentOption, type EditableService } from "@/components/services/service-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CapacityReason } from "@/lib/queue-core";

interface ServiceRecord extends EditableService {
  department: { _id: string; name: string; code: string; workingHours: { start: string; end: string } } | null;
  officers: { _id: string; name: string; counterNumber: number | null; isActive: boolean }[];
  today: {
    date: string;
    reason: CapacityReason | null;
    activeEmployees: number;
    capacity: number;
    issued: number;
    live: number;
    remaining: number;
  };
}

const ALL = "ALL";
const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// useSearchParams needs a Suspense boundary under cacheComponents
export default function ServicesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Services />
    </Suspense>
  );
}

function Services() {
  // ?departmentId= comes from the department detail page's "Services" link
  const searchParams = useSearchParams();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get("departmentId") ?? ALL);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRecord | null>(null);
  const [deactivating, setDeactivating] = useState<ServiceRecord | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bump to reload the list

  // Departments feed the filter and the dialog
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
      if (includeInactive) params.set("includeInactive", "true");
      try {
        const res = await fetch(`/api/v1/services?${params}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load services");
        if (!cancelled) setServices(data.services ?? []);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Couldn't load services");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [departmentFilter, includeInactive, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const refresh = () => {
    setLoading(true);
    reload();
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (service: ServiceRecord) => {
    setEditing(service);
    setDialogOpen(true);
  };

  async function patchActive(service: ServiceRecord, isActive: boolean) {
    const res = await fetch(`/api/v1/services/${service._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Couldn't update the service");
    toast.success(isActive ? `${service.name} is open for booking` : `${service.name} deactivated`);
    notifyConflicts(data.conflicts);
    reload();
  }

  const setActive = (service: ServiceRecord, next: boolean) => {
    if (!next) return setDeactivating(service);
    patchActive(service, true).catch((err) => toast.error(err.message));
  };

  const departmentItems: Record<string, string> = {
    [ALL]: "All departments",
    ...Object.fromEntries(departments.map((d) => [d._id, d.name])),
  };
  const filtersOn = departmentFilter !== ALL || includeInactive;

  return (
    <>
      <PageHeader
        className="reveal"
        kicker="Configuration"
        title="Services"
        description="What citizens book, how long each visit takes, the daily limits and who serves them."
        actions={
          <>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              Refresh
            </Button>
            <Button onClick={openCreate}>
              <Plus />
              New service
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
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={(checked) => {
                setLoading(true);
                setIncludeInactive(checked);
              }}
            />
            <Label htmlFor="include-inactive" className="text-sm">
              Include inactive
            </Label>
          </div>
          <span className="micro-label whitespace-nowrap">{services.length} services</span>
        </div>
      </div>

      <div className="reveal overflow-hidden bg-card shadow-sm ring-1 ring-foreground/5 [--i:2]">
        {loading && services.length === 0 ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
            <Layers className="size-10 text-muted-foreground/40" />
            <h3 className="font-heading text-lg font-semibold uppercase">No services found</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              {filtersOn
                ? "Nothing matches this filter."
                : "Add a service so citizens can book tokens for it."}
            </p>
            <Button size="sm" className="mt-2" onClick={openCreate}>
              <Plus />
              New service
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Min / citizen</TableHead>
                  <TableHead>Last token</TableHead>
                  <TableHead className="text-right">Daily limit</TableHead>
                  <TableHead className="text-right">Days ahead</TableHead>
                  <TableHead className="text-right">Alert lead</TableHead>
                  <TableHead>Officers</TableHead>
                  <TableHead className="w-44">Today</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service._id} className={service.isActive ? undefined : "opacity-70"}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex shrink-0 bg-ink px-2 py-1 font-heading text-xs font-semibold tracking-wide text-cream">
                          {service.code}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold">{service.name}</div>
                          {service.description && (
                            <p className="max-w-48 truncate text-xs text-muted-foreground" title={service.description}>
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{service.department?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{service.avgServiceMinutes}</TableCell>
                    <TableCell className="tabular-nums">{service.cutoffTime}</TableCell>
                    <TableCell className="text-right tabular-nums">{service.dailyTokenLimit}</TableCell>
                    <TableCell className="text-right tabular-nums">{service.bookingWindowDays}</TableCell>
                    <TableCell className="text-right tabular-nums">{service.alertLeadMinutes} min</TableCell>
                    <TableCell>
                      {service.officers.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <div
                          className="flex items-center"
                          title={service.officers.map((officer) => officer.name).join(", ")}
                        >
                          {service.officers.slice(0, 3).map((officer) => (
                            <span
                              key={officer._id}
                              className="-ml-1 inline-flex size-7 items-center justify-center bg-ink font-heading text-[10px] text-cream ring-2 ring-card first:ml-0"
                            >
                              {initials(officer.name)}
                            </span>
                          ))}
                          {service.officers.length > 3 && (
                            <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                              +{service.officers.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <CapacityBar
                        issued={service.today.issued}
                        capacity={service.today.capacity}
                        closedReason={service.today.reason}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={service.isActive}
                          onCheckedChange={(checked) => setActive(service, checked)}
                          aria-label={service.isActive ? `Deactivate ${service.name}` : `Activate ${service.name}`}
                        />
                        {service.isActive ? (
                          <span className="stamp border-status-done-border bg-status-done-bg text-status-done">Open</span>
                        ) : (
                          <span className="stamp border-border text-muted-foreground">Inactive</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(service)} aria-label={`Edit ${service.name}`}>
                        <Edit2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ServiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={editing}
        departments={departments}
        defaultDepartmentId={departmentFilter === ALL ? undefined : departmentFilter}
        onSuccess={reload}
      />

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Deactivate service?"
        description={
          deactivating &&
          `Citizens won't be able to book ${deactivating.name}. ${
            deactivating.today.live > 0
              ? `${deactivating.today.live} token${deactivating.today.live === 1 ? " is" : "s are"} still live today; they stay booked and officers can still serve them.`
              : "Tokens already booked are kept."
          }`
        }
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={async () => {
          if (deactivating) await patchActive(deactivating, false);
        }}
      />
    </>
  );
}
