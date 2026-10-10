"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Crosshair, Hourglass, ListOrdered, Ticket } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { CapacityBar } from "@/components/queue/capacity-bar";
import { LiveBadge } from "@/components/queue/live-badge";
import { StatusBadge, type QueueStatus } from "@/components/queue/status-badge";
import { formatTokenLabel } from "@/components/queue/token-label";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CapacityReason } from "@/lib/queue-core";

interface ServiceRow {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  departmentName: string;
  reason: CapacityReason | null; // why it can't serve today (week off, holiday, no staff...); null: open
  queueStatus: QueueStatus | null; // null: nobody has booked this service for today yet
  issued: number;
  capacity: number | null;
  nowServing: number;
  waiting: number;
  arrived: number;
  inService: number;
  completed: number;
  noShow: number;
}

interface Metrics {
  services: ServiceRow[];
  totals: Pick<ServiceRow, "issued" | "waiting" | "arrived" | "inService" | "completed" | "noShow"> & {
    capacity: number;
  };
  // Today's tokens that reached a counter (lib/impact.ts)
  impact: {
    served: number;
    citizenMinutesSaved: number;
    avgInOfficeWaitMinutes: number | null;
    etaAccuracy: { meanErrorMinutes: number; medianErrorMinutes: number; within15Pct: number; biasMinutes: number } | null;
  };
}

const REFRESH_MS = 15_000;

export default function DashboardPage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [retry, setRetry] = useState(0); // bump to reload right away

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/v1/metrics", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't load today's numbers");
        if (!cancelled) {
          setData(json);
          setError(null);
          setUpdatedAt(Date.now());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load today's numbers");
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [retry]);

  const totals = data?.totals;
  const impact = data?.impact;
  const eta = impact?.etaAccuracy;

  return (
    <>
      <PageHeader
        className="reveal"
        kicker="Overview"
        title="Today"
        description="Live queue numbers across your services."
        actions={<LiveBadge updatedAt={updatedAt} paused={error !== null} />}
      />

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border border-status-cancelled-border bg-status-cancelled-bg px-4 py-3 text-sm text-status-cancelled"
        >
          {error}
          <Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </Button>
        </div>
      )}

      <div className="reveal grid grid-cols-1 gap-4 [--i:1] sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Issued today" value={totals?.issued} icon={Ticket}>
          {totals && <CapacityBar issued={totals.issued} capacity={totals.capacity || null} />}
        </StatTile>
        <StatTile
          label="Waiting"
          value={totals ? totals.waiting + totals.arrived : undefined}
          icon={Clock}
          hint={totals && `${totals.arrived} already at the office`}
        />
        <StatTile label="In service" value={totals?.inService} icon={ListOrdered} hint="At a counter right now" />
        <StatTile
          label="Completed"
          value={totals?.completed}
          icon={CheckCircle2}
          hint={totals && `${totals.noShow} no-show`}
        />
      </div>

      <div className="reveal grid grid-cols-1 gap-4 [--i:2] md:grid-cols-2">
        <StatTile
          label="Citizen-minutes saved"
          value={impact && impact.citizenMinutesSaved.toLocaleString("en-IN")}
          icon={Hourglass}
          hint={
            impact &&
            (impact.served === 0
              ? "Counts once citizens are called to a counter today"
              : `Time not spent waiting in the office, across ${impact.served} served today. ` +
                `Average wait once there: ${impact.avgInOfficeWaitMinutes ?? 0} min.`)
          }
        />
        <StatTile
          label="ETA accuracy"
          value={impact && (eta ? `${eta.within15Pct}%` : "—")}
          icon={Crosshair}
          hint={
            impact &&
            (eta
              ? `Called within 15 min of the time promised at booking. Median gap ${eta.medianErrorMinutes} min` +
                (eta.biasMinutes ? `, ${Math.abs(eta.biasMinutes)} min ${eta.biasMinutes > 0 ? "late" : "early"} on average.` : ".")
              : "Shows once citizens are called to a counter today")
          }
        />
      </div>

      <Card className="reveal [--i:3]">
        <CardHeader>
          <CardTitle>Services today</CardTitle>
          <CardDescription>Issued tokens against capacity, and where each queue stands.</CardDescription>
        </CardHeader>
        <div className="px-(--card-spacing)">
          {!data ? (
            <Skeleton className="h-40 w-full" />
          ) : data.services.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListOrdered />
                </EmptyMedia>
                <EmptyTitle>No services yet</EmptyTitle>
                <EmptyDescription>
                  Services you manage or are assigned to will appear here with their live queue numbers.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Queue</TableHead>
                  <TableHead className="w-44">Issued / capacity</TableHead>
                  <TableHead className="text-right">Waiting</TableHead>
                  <TableHead className="text-right">Arrived</TableHead>
                  <TableHead className="text-right">In service</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Now serving</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.services.map((row) => (
                  <TableRow key={row.serviceId}>
                    <TableCell>
                      <div className="font-semibold">{row.serviceName}</div>
                      <div className="text-xs text-muted-foreground">{row.departmentName}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.queueStatus ?? "NOT_STARTED"} />
                    </TableCell>
                    <TableCell>
                      <CapacityBar issued={row.issued} capacity={row.capacity} closedReason={row.reason} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.waiting}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.arrived}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.inService}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
                    <TableCell className="text-right font-heading text-lg font-semibold tabular-nums">
                      {row.nowServing ? formatTokenLabel(row.serviceCode, row.nowServing) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </>
  );
}
