/** Public site. Header and footer are part of each page (they depend on the page language). */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return children;
}
