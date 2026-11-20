import { type ReactNode, Suspense } from "react";
import { NavIcons } from "@/components/admin/nav-icons";
import { type NavEntry, Sidebar } from "@/components/admin/sidebar";
import { Badge, Spinner } from "@/components/admin/ui";
import { LanguageSwitch } from "@/components/admin/language-switch";
import type { AdminMessages } from "@/i18n/admin";
import { AdminLocaleProvider } from "@/i18n/admin/client";
import { adminLocale, adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can, type Permission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { LogoutButton } from "../(auth)/forms";

// Certificate rendering (headless Chromium, cold start on serverless hosts) can take a while.
export const maxDuration = 60;

/**
 * Signed-in admin area. The session is read inside <Suspense> (required with
 * Cache Components); every page below re-checks its own permission as well.
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Spinner />}>
      <PanelChrome>{children}</PanelChrome>
    </Suspense>
  );
}

const NAV: { href: string; key: keyof AdminMessages["nav"]; permission: Permission; icon: keyof typeof NavIcons }[] = [
  { href: "/admin", key: "dashboard", permission: "dashboard.view", icon: "dashboard" },
  { href: "/admin/statistics", key: "statistics", permission: "stats.view", icon: "statistics" },
  { href: "/admin/certificates", key: "certificates", permission: "certificate.view", icon: "certificates" },
  { href: "/admin/approvals", key: "approvals", permission: "certificate.edit", icon: "approvals" },
  { href: "/admin/companies", key: "companies", permission: "company.view", icon: "companies" },
  { href: "/admin/messages", key: "messages", permission: "message.view", icon: "messages" },
  { href: "/admin/inbox", key: "inbox", permission: "message.view", icon: "inbox" },
  { href: "/admin/import", key: "import", permission: "import.run", icon: "import" },
  { href: "/admin/audit", key: "audit", permission: "audit.view", icon: "audit" },
  { href: "/admin/users", key: "users", permission: "user.manage", icon: "users" },
  { href: "/admin/settings", key: "settings", permission: "settings.manage", icon: "settings" },
];

async function PanelChrome({ children }: { children: ReactNode }) {
  const user = await requireUser({ allowPendingPasswordChange: true });
  const locale = await adminLocale();
  const t = await adminT();

  const visible = user.mustChangePassword ? [] : NAV.filter((n) => can(user.role, n.permission));
  // Badge on "Approvals": how many certificates wait for a decision.
  const pending = visible.some((n) => n.key === "approvals")
    ? await prisma.certificate.count({ where: { status: "PENDING_APPROVAL" } })
    : 0;
  // Badge on "Mailbox": unread received e-mails.
  const unreadMail = visible.some((n) => n.key === "inbox") ? await prisma.inboundEmail.count({ where: { isRead: false } }) : 0;
  // Until the temporary password is replaced, only "My account" is offered.
  const items: NavEntry[] = visible.map((n) => ({
    href: n.href,
    label: t.nav[n.key] as string,
    icon: NavIcons[n.icon],
    badge: n.key === "approvals" ? pending : n.key === "inbox" ? unreadMail : undefined,
  }));
  items.push({ href: "/admin/account", label: t.nav.account, icon: NavIcons.account });

  const footer = (
    <div className="mt-2 rounded-md bg-white/5 px-3 py-2">
      <p className="truncate text-sm font-medium text-white">{user.name}</p>
      <p className="mb-2 truncate text-xs text-slate-400">{user.email}</p>
      <div className="flex items-center justify-between gap-2">
        <Badge tone="blue">{t.roles[user.role]}</Badge>
        <LogoutButton label={t.nav.logout} className="text-xs font-medium text-slate-300 hover:text-white" />
      </div>
      <div className="mt-2 border-t border-white/10 pt-2">
        <LanguageSwitch />
      </div>
    </div>
  );

  return (
    <AdminLocaleProvider locale={locale}>
      <div lang={locale} className="flex flex-1 flex-col lg:flex-row">
        <Sidebar
          items={items}
          footer={footer}
          labels={{ main: t.nav.main, openMenu: t.nav.openMenu, closeMenu: t.nav.closeMenu, viewSite: t.nav.viewSite }}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </AdminLocaleProvider>
  );
}
