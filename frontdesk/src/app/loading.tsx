"use client";

import { Loader } from "@/components/ui/Loader";
import { useT } from "@/lib/i18n";

export default function Loading() {
  const { t } = useT();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader label={t("loading.label")} />
    </div>
  );
}
