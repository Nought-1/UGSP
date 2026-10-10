"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Calendar, Clock, Edit2, Layers, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { notifyConflicts } from "@/components/queue/notify-conflicts";
import { StatTile } from "@/components/stat-tile";
import { DepartmentDialog, type EditableDepartment } from "@/components/departments/department-dialog";
import { HolidayManager, type HolidayItem } from "@/components/departments/holiday-manager";
import { DAYS_OF_WEEK } from "@/components/departments/week-off-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface DepartmentDetail extends EditableDepartment {
  services: Array<{
    _id: string;
    name: string;
    code: string;
    description?: string;
    avgServiceMinutes: number;
    dailyTokenLimit: number;
    cutoffTime: string;
    isActive: boolean;
  }>;
  servicesCount: number;
  employeesCount: number;
  holidaysCount: number;
}

export function DepartmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [department, setDepartment] = useState<DepartmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingHolidays, setSavingHolidays] = useState(false);

  const [reloadKey, setReloadKey] = useState(0); // bump to reload after an edit

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/v1/departments/${id}`);
        if (res.status === 404) {
          toast.error("Department not found");
          router.push("/departments");
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load the department");
        if (!cancelled) setDepartment(data.department);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Couldn't load the department");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, router, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // The holiday manager saves every change straight away
  async function saveHolidays(holidays: HolidayItem[]) {
    setSavingHolidays(true);
    try {
      const res = await fetch(`/api/v1/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holidays }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the holidays");
      setDepartment((prev) => (prev ? { ...prev, holidays, holidaysCount: holidays.length } : prev));
      notifyConflicts(data.conflicts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the holidays");
    } finally {
      setSavingHolidays(false);
    }
  }

  if (loading && !department) {
    return (
      <>
        <Skeleton className="h-16 w-80" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  if (!department) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <h2 className="font-heading text-xl font-semibold uppercase">Department not found</h2>
        <p className="text-sm text-muted-foreground">It may have been removed, or the link is wrong.</p>
        <Button variant="outline" render={<Link href="/departments" />} nativeButton={false}>
          Back to departments
        </Button>
      </div>
    );
  }

  const offDays = new Set(department.weekOffDays);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="reveal -ml-2 self-start"
        render={<Link href="/departments" />}
        nativeButton={false}
      >
        <ArrowLeft />
        Departments
      </Button>

      <PageHeader
        className="reveal"
        kicker={`Department · ${department.code}`}
        title={department.name}
        description={[department.address, department.city].filter(Boolean).join(", ") || undefined}
        actions={
          <>
            {department.isActive ? (
              <span className="stamp border-status-done-border bg-status-done-bg text-status-done">Open</span>
            ) : (
              <span className="stamp border-border text-muted-foreground">Inactive</span>
            )}
            <Button onClick={() => setDialogOpen(true)}>
              <Edit2 />
              Edit department
            </Button>
          </>
        }
      />

      <div className="reveal grid grid-cols-2 gap-4 [--i:1] lg:grid-cols-4">
        <StatTile
          label="Hours"
          value={`${department.workingHours.start}–${department.workingHours.end}`}
          icon={Clock}
          hint={department.timezone}
        />
        <StatTile label="Days open" value={7 - offDays.size} icon={Calendar}>
          {/* Weekly notice, like frontdesk's office card: days off are struck through */}
          <div className="flex gap-1.5" aria-label="Working days">
            {DAYS_OF_WEEK.map((day) => (
              <span
                key={day.index}
                title={offDays.has(day.index) ? `${day.full}: closed` : `${day.full}: open`}
                className={cn(
                  "font-heading text-sm font-semibold",
                  offDays.has(day.index) && "text-muted-foreground line-through"
                )}
              >
                {day.label.charAt(0)}
              </span>
            ))}
          </div>
        </StatTile>
        <StatTile label="Services" value={department.servicesCount} icon={Layers} hint={`${department.employeesCount} staff`} />
        <StatTile label="Holidays" value={department.holidaysCount} icon={Calendar} hint="Closed on these dates" />
      </div>

      <Tabs defaultValue="holidays" className="reveal [--i:2]">
        <TabsList>
          <TabsTrigger value="holidays">Holidays ({department.holidaysCount})</TabsTrigger>
          <TabsTrigger value="services">Services ({department.servicesCount})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="holidays">
          <Card>
            <CardHeader>
              <CardTitle>Holidays and closures</CardTitle>
              <CardDescription>
                No tokens can be booked on these dates. Changes are saved as you make them.
              </CardDescription>
              {savingHolidays && (
                <span className="micro-label flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  Saving
                </span>
              )}
            </CardHeader>
            <CardContent>
              <HolidayManager holidays={department.holidays} onChange={saveHolidays} disabled={savingHolidays} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>What citizens can book at this department.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {department.services.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {department.services.map((service) => (
                    <div key={service._id} className="flex flex-col gap-2 bg-background p-4 ring-1 ring-foreground/10">
                      <div className="flex items-center justify-between gap-2">
                        <span className="bg-ink px-2 py-0.5 font-heading text-xs font-semibold tracking-wide text-cream">
                          {service.code}
                        </span>
                        {service.isActive ? (
                          <span className="stamp border-status-done-border bg-status-done-bg text-status-done">Active</span>
                        ) : (
                          <span className="stamp border-border text-muted-foreground">Inactive</span>
                        )}
                      </div>
                      <h4 className="font-semibold">{service.name}</h4>
                      {service.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{service.description}</p>
                      )}
                      <div className="flex justify-between border-t pt-2 text-xs text-muted-foreground tabular-nums">
                        <span>{service.dailyTokenLimit} a day</span>
                        <span>~{service.avgServiceMinutes} min each</span>
                        <span>Last {service.cutoffTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 border border-dashed py-10 text-center">
                  <Layers className="size-8 text-muted-foreground/40" />
                  <p className="text-sm font-semibold">No services yet</p>
                  <p className="text-xs text-muted-foreground">Services added for this department show up here.</p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                render={<Link href={`/services?departmentId=${department._id}`} />}
                nativeButton={false}
              >
                <Plus />
                Manage services
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Use Edit department to change any of these.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                {[
                  ["Code", department.code],
                  ["City", department.city || "Not set"],
                  ["Address", department.address || "Not set"],
                  ["Hours", `${department.workingHours.start} to ${department.workingHours.end}`],
                  ["Time zone", department.timezone],
                  ["Staff", String(department.employeesCount)],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1 border-b pb-3">
                    <dt className="micro-label">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DepartmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        department={department}
        onSuccess={reload}
      />
    </>
  );
}
