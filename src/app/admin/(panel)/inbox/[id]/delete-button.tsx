"use client";

import { buttonClass } from "@/components/admin/ui";

export function DeleteEmailButton({ action, label, confirmText }: { action: () => Promise<void>; label: string; confirmText: string }) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={buttonClass.danger}
        onClick={(e) => {
          if (!window.confirm(confirmText)) e.preventDefault();
        }}
      >
        {label}
      </button>
    </form>
  );
}
