"use client";

import { useEffect } from "react";
import { Alert } from "./ui";

type State = { status: "idle" | "success" | "error"; message?: string; redirectTo?: string };

/**
 * After a successful admin action that moves to another page: full page load,
 * so lists and detail pages are rebuilt from the database (no stale router trees).
 */
export function useActionRedirect(state: State) {
  useEffect(() => {
    if (state.status === "success" && state.redirectTo) window.location.assign(state.redirectTo);
  }, [state]);
}

/** Success / error message of an action (nothing while idle or while redirecting). */
export function ActionMessage({ state }: { state: State }) {
  if (state.status === "idle" || !state.message || state.redirectTo) return null;
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>;
}
