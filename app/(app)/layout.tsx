import { redirect } from "next/navigation";
import { BottomNav, SideNav } from "@/components/bottom-nav";
import { requireUser, userSupermarketIds } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, user } = await requireUser();
  const supers = await userSupermarketIds(supabase, user.id);
  if (supers.length === 0) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <SideNav email={user.email ?? null} />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-4 md:max-w-5xl md:px-8 md:pb-10 md:pt-8">{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}
