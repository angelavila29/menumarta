import { requireUser, userSupermarketIds } from "@/lib/auth";
import { saveSettings, signOut } from "@/lib/actions";

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const [{ data: supermarkets }, { data: profile }, mine] = await Promise.all([
    supabase.from("supermarkets").select("id,name").order("name"),
    supabase.from("profiles").select("postal_code").eq("id", user.id).maybeSingle(),
    userSupermarketIds(supabase, user.id),
  ]);
  const chosen = new Set(mine);

  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">Ajustes</h1>
      <form action={saveSettings} className="flex flex-col gap-5">
        <div>
          <label htmlFor="postal_code" className="mb-1 block text-sm font-medium text-zinc-700">
            Código postal
          </label>
          <input
            id="postal_code"
            name="postal_code"
            inputMode="numeric"
            pattern="[0-9]{5}"
            maxLength={5}
            defaultValue={profile?.postal_code ?? ""}
            placeholder="28001"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg outline-none focus:border-green-600"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-700">Mis supermercados</legend>
          <div className="flex flex-col gap-2">
            {(supermarkets ?? []).map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg"
              >
                <input
                  type="checkbox"
                  name="supermarkets"
                  value={s.id}
                  defaultChecked={chosen.has(s.id)}
                  className="h-5 w-5 accent-green-600"
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="rounded-xl bg-green-600 px-4 py-3 text-lg font-semibold text-white active:bg-green-700"
        >
          Guardar
        </button>
      </form>

      <div className="mt-10 border-t border-zinc-200 pt-4">
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
