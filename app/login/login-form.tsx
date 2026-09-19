"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Se activa en Vercel cuando el correo propio está configurado (scripts/setup_email.ts):
// el correo trae un código de 6 dígitos y no dependemos de que el enlace abra la app instalada.
const CODE_LOGIN = process.env.NEXT_PUBLIC_LOGIN_CODE === "1";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying">("idle");
  const [error, setError] = useState("");

  // Sin sesión no deben quedar pantallas guardadas de otra persona en este dispositivo
  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage("clear");
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("idle");
      setError(error.status === 429 ? "Has pedido demasiados correos seguidos. Espera unos minutos y vuelve a intentarlo." : error.message);
    } else {
      setStatus("sent");
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    setError("");
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setStatus("sent");
      setError("Ese código no es correcto o ha caducado. Pide otro.");
    } else {
      router.replace("/");
      router.refresh();
    }
  }

  if (status === "sent" || status === "verifying") {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold">Revisa tu correo</p>
        <p className="mt-1 text-sm text-muted">
          Te hemos escrito a <b className="text-ink">{email}</b>.{" "}
          {CODE_LOGIN ? "Copia aquí el código de 6 dígitos." : "Abre el enlace desde este mismo dispositivo."}
        </p>
        {CODE_LOGIN && (
          <form onSubmit={verify} className="mt-4 flex flex-col gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Código de 6 dígitos"
              autoFocus
              className="rounded-xl border border-cream-dark bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-brand"
            />
            <button type="submit" disabled={code.length !== 6 || status === "verifying"} className="rounded-xl bg-brand px-4 py-3 text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-60">
              {status === "verifying" ? "Comprobando…" : "Entrar"}
            </button>
          </form>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={() => { setStatus("idle"); setCode(""); setError(""); }} className="mt-4 text-sm font-medium text-brand hover:underline">
          Usar otro correo o pedir otro
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3">
      <label className="text-sm font-semibold" htmlFor="email">Tu correo</label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        className="rounded-xl border border-cream-dark bg-white px-4 py-3 text-lg outline-none focus:border-brand"
      />
      <button type="submit" disabled={status === "sending"} className="rounded-xl bg-brand px-4 py-3 text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-60">
        {status === "sending" ? "Enviando…" : CODE_LOGIN ? "Enviarme el código" : "Enviarme el enlace"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <p className="text-center text-xs text-muted">Sin contraseña. Te llega un correo y entras.</p>
    </form>
  );
}
