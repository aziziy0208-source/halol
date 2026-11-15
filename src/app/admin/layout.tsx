import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "WHU Admin", template: "%s · WHU Admin" },
  robots: { index: false, follow: false },
};

/** Admin area: English UI (the public site is German), never indexed. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div lang="en" className="flex min-h-full flex-1 flex-col bg-slate-100 font-sans text-sm text-slate-800">
      {children}
    </div>
  );
}
