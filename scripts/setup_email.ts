/**
 * Configura el correo propio de Supabase Auth y la plantilla con código de 6 dígitos.
 * Hace falta porque el correo por defecto de Supabase limita a 2 envíos por hora y no deja
 * cambiar la plantilla.
 *
 * 1. Crea una cuenta gratuita en https://resend.com (o Brevo) y una API key.
 *    Con Resend: host smtp.resend.com, puerto 465, usuario "resend", contraseña = la API key.
 *    Para enviar a cualquier dirección hay que verificar un dominio; sin dominio, Resend solo
 *    deja enviar a tu propio correo.
 * 2. Ejecuta:
 *    SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=gdfsyyzhlcegeowbodyq \
 *    SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend SMTP_PASS=re_... \
 *    SMTP_SENDER=hola@tudominio.es npx tsx scripts/setup_email.ts
 * 3. En Vercel añade la variable NEXT_PUBLIC_LOGIN_CODE=1 y vuelve a desplegar: la pantalla de
 *    acceso pedirá el código en vez de depender del enlace.
 */
import { readFileSync } from "node:fs";

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta la variable ${k}`);
  return v;
};

async function main() {
  const token = need("SUPABASE_ACCESS_TOKEN");
  const ref = need("SUPABASE_PROJECT_REF");
  const html = readFileSync("supabase/email_code.html", "utf8");
  const body = {
    smtp_host: need("SMTP_HOST"),
    smtp_port: process.env.SMTP_PORT ?? "465",
    smtp_user: need("SMTP_USER"),
    smtp_pass: need("SMTP_PASS"),
    smtp_admin_email: need("SMTP_SENDER"),
    smtp_sender_name: "Sobremesa",
    rate_limit_email_sent: 30,
    mailer_otp_length: 6,
    mailer_subjects_magic_link: "Tu código de Sobremesa: {{ .Token }}",
    mailer_templates_magic_link_content: html,
    mailer_subjects_confirmation: "Tu código de Sobremesa: {{ .Token }}",
    mailer_templates_confirmation_content: html,
  };
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json()) as Record<string, unknown>;
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${JSON.stringify(data)}`);
  console.log("Correo configurado:", data.smtp_host, "· límite por hora:", data.rate_limit_email_sent);
  console.log("Ahora añade NEXT_PUBLIC_LOGIN_CODE=1 en Vercel y vuelve a desplegar.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
