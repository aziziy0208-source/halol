"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

/** `badge`: a count shown next to the label (e.g. certificates waiting for approval). */
export type NavEntry = { href: string; label: string; icon: ReactNode; badge?: number };

type Props = {
  items: NavEntry[];
  labels: { main: string; openMenu: string; closeMenu: string; viewSite: string };
  footer: ReactNode;
};

/** Left navigation (drawer on mobile). Items are pre-filtered by permission on the server. */
export function Sidebar({ items, labels, footer }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav aria-label={labels.main} className="flex flex-1 flex-col gap-0.5 px-3 py-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
            isActive(item.href) ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className="h-4 w-4 shrink-0" aria-hidden>
            {item.icon}
          </span>
          <span className="flex-1">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-slate-900 tabular-nums">
              {item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-slate-900 px-4 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2 text-sm font-semibold text-white">
          <Image src="/assets/brand/whu-logo.png" alt="" width={48} height={28} />
          WHU Admin
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          aria-label={open ? labels.closeMenu : labels.openMenu}
          className="rounded p-2 text-slate-200 hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <aside
        id="admin-sidebar"
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 w-64 flex-col bg-slate-900 lg:sticky lg:top-0 lg:flex lg:h-svh`}
      >
        <Link href="/admin" className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Image src="/assets/brand/whu-logo.png" alt="" width={62} height={36} />
          <span className="text-sm font-semibold text-white">WHU Admin</span>
        </Link>
        {nav}
        <div className="border-t border-white/10 px-3 py-3">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="block rounded-md px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"
          >
            {labels.viewSite} ↗
          </a>
          {footer}
        </div>
      </aside>
      {open ? (
        <button
          type="button"
          aria-label={labels.closeMenu}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
