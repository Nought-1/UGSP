"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useCancelToken } from "@/hooks/useToken";
import type { TokenDTO } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";
import { fmtDay } from "@/lib/format";

// Cancel is an update, so it happens in a dialog (AGENT.md §9). Open it by passing a token; close with null.
export function CancelTokenDialog({ token, onClose }: { token: TokenDTO | null; onClose: () => void }) {
  const { t, te, lang } = useT();
  const cancel = useCancelToken();
  const toast = useToast();

  return (
    <ConfirmDialog
      isOpen={!!token}
      onClose={onClose}
      title={t("cancel.title")}
      description={token ? t("cancel.body", { label: token.label, date: fmtDay(token.date, lang) }) : ""}
      confirmText={t("cancel.confirm")}
      cancelText={t("cancel.keep")}
      variant="danger"
      isLoading={cancel.isPending}
      onConfirm={() =>
        token &&
        cancel.mutate(token.id, {
          onSuccess: () => {
            toast.success(t("cancel.done"), token.label);
            onClose();
          },
          onError: (err) => toast.error(te(err)),
        })
      }
    />
  );
}
