import { requireUser } from "@/lib/auth";
import { Onboarding } from "./onboarding";

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: mine }] = await Promise.all([
    supabase.from("profiles").select("address,postal_code,lat,lng,display_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_supermarkets").select("supermarket_id").eq("user_id", user.id),
  ]);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Onboarding
        initialAddress={profile?.address ?? profile?.postal_code ?? ""}
        initialName={profile?.display_name ?? ""}
        initialChains={(mine ?? []).map((m) => m.supermarket_id as string)}
        isFirstTime={(mine ?? []).length === 0}
      />
    </main>
  );
}
