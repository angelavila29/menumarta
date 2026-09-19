"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { WhatsAppIcon } from "@/components/icons-extra";
import { acceptFriend, inviteByEmail, removeFriend, requestFriend, setFriendRecipesMode } from "@/lib/friends-actions";

export type Friendship = { other_id: string; display_name: string; status: string; incoming: boolean; recipes: number };

export function Friends({ code, inviteUrl, myName, friendships, incomingCode, recipesMode, invitedEmails }: { code: string; inviteUrl: string; myName: string; friendships: Friendship[]; incomingCode: string; recipesMode: "all" | "saved"; invitedEmails: string[] }) {
  const [mode, setMode] = useState(recipesMode);
  const [input, setInput] = useState(incomingCode && incomingCode.toUpperCase() !== code ? incomingCode.toUpperCase() : "");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const friends = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.incoming);
  const outgoing = friendships.filter((f) => f.status === "pending" && !f.incoming);
  const shareText = `${myName} te invita a Sobremesa para compartir recetas. Entra aquí y añádeme: ${inviteUrl}`;

  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await requestFriend(input);
      setMsg(res.ok ? { text: res.message, ok: true } : { text: res.error, ok: false });
      if (res.ok) setInput("");
    });
  }

  return (
    <main className="md:max-w-3xl">
      <h1 className="text-3xl font-bold md:text-5xl">Amigos</h1>
      <p className="mt-1 text-muted md:text-lg">Añade a tus amigos para ver sus recetas y que vean las tuyas.</p>

      <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Invita a alguien</h2>
        <p className="text-sm text-muted">Envíale tu enlace. Al abrirlo solo tendrá que pulsar «Añadir».</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-cream px-4 py-2.5 font-mono text-lg font-bold tracking-widest">{code}</span>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="rounded-xl border border-cream-dark bg-white px-4 py-2.5 font-medium hover:bg-cream"
          >
            {copied ? "Enlace copiado ✓" : "Copiar enlace"}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-xl bg-olive-soft px-4 py-2.5 font-semibold text-olive-dark hover:bg-olive/20">
            <WhatsAppIcon className="h-5 w-5" /> Enviar por WhatsApp
          </a>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">¿Todavía no tiene cuenta?</h2>
        <p className="text-sm text-muted">Sobremesa es solo por invitación. Apunta su correo y ya podrá entrar con tu enlace.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await inviteByEmail(inviteEmail);
              setInviteMsg(res.ok ? { text: res.message, ok: true } : { text: res.error, ok: false });
              if (res.ok) setInviteEmail("");
            });
          }}
          className="mt-3 flex gap-2"
        >
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="correo@desuamigo.com"
            aria-label="Correo de quien quieres invitar"
            className="min-w-0 flex-1 rounded-xl border border-cream-dark bg-white px-4 py-2.5 outline-none focus:border-brand sm:max-w-xs"
          />
          <button type="submit" disabled={pending || inviteEmail.trim().length < 5} className="rounded-xl border border-brand px-5 py-2.5 font-semibold text-brand hover:bg-brand-soft disabled:opacity-50">
            Invitar
          </button>
        </form>
        {inviteMsg && <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${inviteMsg.ok ? "bg-olive-soft text-olive-dark" : "bg-red-50 text-red-700"}`}>{inviteMsg.text}</p>}
        {invitedEmails.length > 0 && <p className="mt-2 text-xs text-muted">Ya has invitado a: {invitedEmails.join(", ")}</p>}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Añadir con un código</h2>
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Código de tu amigo"
            aria-label="Código de tu amigo"
            maxLength={12}
            className="min-w-0 flex-1 rounded-xl border border-cream-dark bg-white px-4 py-2.5 font-mono uppercase tracking-widest outline-none focus:border-brand sm:max-w-xs"
          />
          <button type="submit" disabled={pending || input.trim().length < 6} className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {pending ? "Un momento…" : "Añadir"}
          </button>
        </form>
        {msg && <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? "bg-olive-soft text-olive-dark" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      </section>

      {incoming.length > 0 && (
        <section className="mt-4 rounded-2xl bg-brand-soft p-5">
          <h2 className="text-lg font-bold">Solicitudes recibidas</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {incoming.map((f) => (
              <li key={f.other_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
                <Avatar name={f.display_name} />
                <span className="min-w-0 flex-1 font-semibold">{f.display_name}</span>
                <button type="button" disabled={pending} onClick={() => start(() => acceptFriend(f.other_id))} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Aceptar</button>
                <button type="button" disabled={pending} onClick={() => start(() => removeFriend(f.other_id))} className="rounded-xl border border-cream-dark px-4 py-2 text-sm font-medium hover:bg-cream">Rechazar</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Sus recetas en tu menú</h2>
        <p className="text-sm text-muted">Elige qué recetas de tus amigos puede usar «Generar semana». Siempre puedes poner cualquiera a mano.</p>
        <ul className="mt-3 flex flex-col gap-1">
          {([
            ["all", "Todas las recetas de mis amigos", "Entran en el sorteo junto a las tuyas y las de Sobremesa, respetando tu dieta y alergias."],
            ["saved", "Solo las que yo guarde", "Marca con el corazón las que te gusten y solo se usarán esas."],
          ] as const).map(([id, title, desc]) => (
            <li key={id}>
              <button
                type="button"
                role="radio"
                aria-checked={mode === id}
                disabled={pending}
                onClick={() => {
                  setMode(id);
                  start(() => setFriendRecipesMode(id));
                }}
                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left ${mode === id ? "border-brand bg-brand-soft" : "border-transparent hover:bg-cream"}`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${mode === id ? "border-brand" : "border-cream-dark"}`}>
                  {mode === id && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-muted">{desc}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Tus amigos ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Todavía no tienes amigos en Sobremesa. Envía tu enlace a alguien para empezar.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {friends.map((f) => (
              <li key={f.other_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-cream-dark p-3">
                <Avatar name={f.display_name} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{f.display_name}</span>
                  <span className="block text-xs text-muted">{f.recipes} {f.recipes === 1 ? "receta compartida" : "recetas compartidas"}</span>
                </span>
                <Link href={`/recetas?autor=${f.other_id}`} className="rounded-xl bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand hover:text-white">Ver sus recetas</Link>
                <button type="button" disabled={pending} onClick={() => { if (confirm(`¿Dejar de ser amigo de ${f.display_name}?`)) start(() => removeFriend(f.other_id)); }} className="text-sm text-muted hover:text-red-700">Quitar</button>
              </li>
            ))}
          </ul>
        )}
        {outgoing.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-muted">Solicitudes enviadas</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {outgoing.map((f) => (
                <li key={f.other_id} className="flex items-center gap-3 rounded-xl border border-dashed border-cream-dark p-3 text-sm">
                  <span className="min-w-0 flex-1">{f.display_name} · pendiente de aceptar</span>
                  <button type="button" disabled={pending} onClick={() => start(() => removeFriend(f.other_id))} className="text-muted hover:text-red-700">Cancelar</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

function Avatar({ name }: { name: string }) {
  return <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive font-semibold text-white">{name.charAt(0).toUpperCase()}</span>;
}
