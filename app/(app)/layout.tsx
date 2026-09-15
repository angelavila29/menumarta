import { redirect } from "next/navigation";
import { BottomNav, SideNav, TopBar } from "@/components/bottom-nav";
import { requireUser, userSupermarketIds } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, user } = await requireUser();
  const [supers, { data: profile }] = await Promise.all([
    userSupermarketIds(supabase, user.id),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (supers.length === 0) redirect("/onboarding");
  const name = profile?.display_name?.trim() || capitalize(user.email?.split("@")[0] ?? "");

  return (
    <div className="flex min-h-screen">
      <SideNav />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-4 md:max-w-6xl md:px-8 md:pb-10 md:pt-5">
          <TopBar name={name} />
          <div className="md:mt-6">{children}</div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
