"use client";

import { useEffect } from "react";

/**
 * Full page load to `to`. Used at authentication boundaries instead of router
 * redirects: a server action that sets a cookie re-renders the current page, and
 * the client router keeps visited pages in hidden trees and cached payloads —
 * after a sign-in, 2FA step or password change everything must be rebuilt fresh.
 */
export function HardRedirect({ to, label }: { to: string; label: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <p role="status" className="py-6 text-center text-sm text-slate-500">
      {label}
    </p>
  );
}
