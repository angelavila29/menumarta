"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl bg-brand-soft p-5 text-center">
        <p className="text-lg font-semibold text-brand-dark">Revisa tu correo</p>
        <p className="mt-1 text-sm text-brand">
          Te hemos enviado un enlace a <b>{email}</b>. Ábrelo desde este mismo móvil.
        </p>
        <button onClick={() => setStatus("idle")} className="mt-4 text-sm text-brand-dark underline">
          Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-zinc-700" htmlFor="email">
        Tu correo
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-xl bg-brand px-4 py-3 text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-60"
      >
        {status === "sending" ? "Enviando…" : "Enviarme el enlace"}
      </button>
      {status === "error" && <p className="text-sm text-red-700">{message}</p>}
      <p className="text-center text-xs text-zinc-500">Sin contraseña. Te llega un enlace y entras.</p>
    </form>
  );
}
