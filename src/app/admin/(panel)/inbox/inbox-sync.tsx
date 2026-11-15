"use client";

import { useEffect, useState, useTransition } from "react";
import { buttonClass } from "@/components/admin/ui";
import { useAdminMessages } from "@/i18n/admin/client";
import { type SyncState, syncInboxAction } from "./actions";

/** Checks the provider for new mail when the mailbox opens; also a manual refresh button. */
export function InboxSync() {
  const t = useAdminMessages().inbox;
  const [state, setState] = useState<SyncState | null>(null);
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      setState(await syncInboxAction());
    });

  useEffect(() => {
    startTransition(async () => {
      setState(await syncInboxAction());
    });
  }, []);

  const message = pending
    ? t.syncing
    : state === null
      ? ""
      : state.status === "ok"
        ? t.synced(state.imported)
        : state.status === "notConfigured"
          ? t.notConfigured
          : state.status === "busy"
            ? t.busy
            : state.status === "forbidden"
              ? ""
              : t.syncFailed;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span role="status" className={`text-sm ${state?.status === "error" || state?.status === "notConfigured" ? "text-red-700" : "text-slate-500"}`}>
        {message}
      </span>
      <button type="button" onClick={run} disabled={pending} className={buttonClass.secondary}>
        {t.refresh}
      </button>
    </div>
  );
}
