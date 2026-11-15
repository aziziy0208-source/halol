import { Footer } from "@/components/site/footer";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
