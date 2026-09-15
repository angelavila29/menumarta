import Link from "next/link";
import { ChainLogo } from "@/components/chain-logo";
import { requireUser } from "@/lib/auth";
import { saveDisplayName, signOut } from "@/lib/actions";

export default async function SettingsPage(props: PageProps<"/ajustes">) {
  const sp = await props.searchParams;
  const saved = sp.guardado === "1";
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: mine }] = await Promise.all([
    supabase.from("profiles").select("postal_code,address,display_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_supermarkets").select("supermarket:supermarkets(id,name,has_prices)").eq("user_id", user.id),
  ]);
  const chains = (mine ?? [])
    .map((m) => m.supermarket as unknown as { id: string; name: string; has_prices: boolean } | null)
    .filter((s): s is { id: string; name: string; has_prices: boolean } => s !== null)
    .sort((a, b) => Number(b.has_prices) - Number(a.has_prices) || a.name.localeCompare(b.name, "es"));

  return (
    <main className="md:max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Ajustes</h1>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <form action={saveDisplayName} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-zinc-500">Tu nombre</span>
            <input
              name="display_name"
              type="text"
              defaultValue={profile?.display_name ?? ""}
              placeholder="Como quieres que te saludemos"
              maxLength={40}
              autoComplete="given-name"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg outline-none focus:border-brand"
            />
          </label>
          <button type="submit" className="rounded-xl bg-brand px-5 py-3 font-semibold text-white active:bg-brand-dark">
            Guardar
          </button>
        </form>
        {saved && <p className="mt-2 text-sm text-olive-dark">Guardado ✓</p>}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-500">Dónde vivo</h2>
        <p className="mt-1 text-lg">{profile?.address ?? profile?.postal_code ?? "Sin ubicación"}</p>

        <h2 className="mt-5 text-sm font-medium text-zinc-500">Mis supermercados</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {chains.map((c) => (
            <li
              key={c.id}
              className={`flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-sm ${c.has_prices ? "bg-brand-soft text-brand-dark" : "bg-zinc-100 text-zinc-600"}`}
              title={c.has_prices ? "Con precios" : "Sin precios todavía"}
            >
              <ChainLogo id={c.id} name={c.name} size={20} />
              {c.name}
              {!c.has_prices && " · sin precios"}
            </li>
          ))}
        </ul>

        <Link
          href="/onboarding"
          className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-white active:bg-brand-dark"
        >
          Cambiar ubicación o supermercados
        </Link>
      </section>

      <div className="mt-8 border-t border-zinc-200 pt-4">
        <p className="mb-2 text-sm text-zinc-500">Sesión iniciada como {user.email}</p>
        <form action={signOut}>
          <button type="submit" className="text-sm text-red-700 underline">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
