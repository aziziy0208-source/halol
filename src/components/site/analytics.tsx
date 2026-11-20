"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Sends one anonymous page-view beacon per page (first-party statistics, see
 * src/lib/analytics). No cookies, nothing stored in the browser. Only the first view
 * of a page load reports the external referrer; later in-app navigations don't.
 */
export function Analytics() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const body = JSON.stringify({
      p: window.location.pathname,
      q: window.location.search,
      r: first.current ? document.referrer : "",
      w: window.innerWidth,
    });
    first.current = false;
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/collect", blob)) {
      void fetch("/api/collect", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(
        () => undefined,
      );
    }
  }, [pathname]);
  return null;
}
