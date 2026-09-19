import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { Friends, type Friendship } from "./friends";

export default async function FriendsPage(props: PageProps<"/amigos">) {
  const sp = await props.searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: rows }, { data: invited }] = await Promise.all([
    supabase.from("profiles").select("friend_code,display_name,friend_recipes_mode").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_friendships"),
    supabase.from("signup_allowlist").select("email").eq("invited_by", user.id),
  ]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "menumarta.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const code = (profile?.friend_code as string | null) ?? "";

  return (
    <Friends
      code={code}
      inviteUrl={`${proto}://${host}/amigos?codigo=${code}`}
      myName={profile?.display_name?.trim() || "Alguien"}
      friendships={(rows ?? []) as Friendship[]}
      incomingCode={typeof sp.codigo === "string" ? sp.codigo : ""}
      recipesMode={profile?.friend_recipes_mode === "saved" ? "saved" : "all"}
      invitedEmails={(invited ?? []).map((i) => i.email as string)}
    />
  );
}
