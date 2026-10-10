"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CancelTokenDialog } from "@/components/queue/CancelTokenDialog";
import { LivePanel } from "@/components/queue/LivePanel";
import { OfficeInfo } from "@/components/queue/OfficeInfo";
import { StatusTimeline } from "@/components/queue/StatusTimeline";
import { TokenSlip } from "@/components/queue/TokenSlip";
import { useTokenStatus } from "@/hooks/useToken";
import { ApiError } from "@/lib/api-client";
import { useT } from "@/lib/i18n";

// Next 14: params is a plain object
export default function TokenStatusPage({ params }: { params: { id: string } }) {
  const { t } = useT();
  const status = useTokenStatus(params.id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const data = status.data;

  return (
    <div className="space-y-6 py-2">
      <Link href="/citizen/history" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        {t("token.backToList")}
      </Link>

      {status.isLoading && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 lg:col-span-5" />
          <Skeleton className="h-96 lg:col-span-7" />
        </div>
      )}

      {status.isError && (
        <EmptyState
          title={status.error instanceof ApiError && status.error.code === "NOT_FOUND" ? t("token.notFound") : t("common.loadError")}
          action={<Button variant="outline" onClick={() => status.refetch()}>{t("common.retry")}</Button>}
        />
      )}

      {data && (
        // DOM order is the phone order (answer first, then the slip, then details);
        // on desktop the slip sits left and sticks while the right column scrolls.
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="reveal lg:col-span-7 lg:col-start-6 lg:row-start-1">
            <LivePanel status={data} updatedAt={status.dataUpdatedAt} />
          </div>

          <div className="reveal lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1" style={{ animationDelay: "60ms" }}>
            <div className="lg:sticky lg:top-24">
              <TokenSlip token={data.token} etaIso={data.liveEtaAt} />
            </div>
          </div>

          <div className="reveal space-y-6 lg:col-span-7 lg:col-start-6 lg:row-start-2" style={{ animationDelay: "120ms" }}>
            {!["CANCELLED", "NO_SHOW"].includes(data.token.status) && (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <StatusTimeline status={data.token.status} />
              </section>
            )}
            <OfficeInfo office={data.office} />
            {data.token.status === "WAITING" && (
              <Button variant="outline" className="w-full border-brand/40 text-brand hover:bg-brand/5" onClick={() => setCancelOpen(true)}>
                {t("token.cancel")}
              </Button>
            )}
          </div>
        </div>
      )}

      <CancelTokenDialog token={cancelOpen && data ? data.token : null} onClose={() => setCancelOpen(false)} />
    </div>
  );
}
