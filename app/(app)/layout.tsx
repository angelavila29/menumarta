import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4">{children}</div>
      <BottomNav />
    </>
  );
}
