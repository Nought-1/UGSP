"use client";

import React from "react";
import { Clock, ShieldCheck } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { useT } from "@/lib/i18n";

export function Footer() {
  const { t } = useT();
  return (
    <footer className="mt-auto border-t border-border bg-card py-6 text-xs text-muted">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand" />
          <span className="font-heading font-bold text-ink">{APP_NAME}</span>
          <span>— {t("app.fullName")}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            {t("footer.secure")}
          </span>
        </div>
      </div>
    </footer>
  );
}
