"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useServices } from "@/hooks/useBooking";
import type { ServiceDTO } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";
import { fmtClock } from "@/lib/format";

interface Group {
  id: string;
  name: string;
  city?: string;
  services: ServiceDTO[];
}

// Search over every service, grouped under its office; picking a service fixes the office
export function ServicePicker({ onPick }: { onPick: (service: ServiceDTO) => void }) {
  const { t, lang } = useT();
  const services = useServices();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (services.data ?? []).filter(
      (s) => !needle || [s.name, s.code, s.departmentName, s.city ?? ""].some((v) => v.toLowerCase().includes(needle))
    );
    const byOffice = new Map<string, Group>();
    for (const s of matches) {
      const group = byOffice.get(s.departmentId) ?? { id: s.departmentId, name: s.departmentName, city: s.city, services: [] };
      group.services.push(s);
      byOffice.set(s.departmentId, group);
    }
    return [...byOffice.values()];
  }, [services.data, query]);

  return (
    <div className="space-y-3">
      <Input
        autoFocus
        type="search"
        aria-label={t("book.search")}
        placeholder={t("book.search")}
        leftIcon={<Search className="h-4 w-4" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-card">
        {services.isLoading && (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}

        {services.isError && (
          <div className="space-y-3 p-6 text-center">
            <p className="text-sm text-muted">{t("common.loadError")}</p>
            <Button variant="outline" size="sm" onClick={() => services.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {services.data && services.data.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">{t("book.noServices")}</p>
        )}
        {services.data && services.data.length > 0 && groups.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">{t("book.noMatch", { q: query.trim() })}</p>
        )}

        {groups.map((group) => (
          <section key={group.id}>
            <h3 className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-border bg-cream/95 px-4 py-2 backdrop-blur">
              <span className="font-heading text-sm font-bold uppercase tracking-[0.08em] text-ink">{group.name}</span>
              {group.city && <span className="micro-label">{group.city}</span>}
            </h3>
            <ul>
              {group.services.map((service) => (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() => onPick(service)}
                    className="flex min-h-[56px] w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-cream focus:outline-none focus-visible:bg-cream"
                  >
                    <span className="shrink-0 rounded-md bg-ink px-1.5 py-0.5 font-heading text-xs tracking-wider text-cream">
                      {service.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{service.name}</span>
                      <span className="block text-xs text-muted">
                        {t("book.avgEach", { n: service.avgServiceMinutes })} ·{" "}
                        {t("book.lastToken", { time: fmtClock(service.cutoffTime, lang) })}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
