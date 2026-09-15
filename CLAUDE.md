@AGENTS.md

# Contexto del proyecto

Web app para planificar el menú semanal y la lista de la compra con precios reales
de supermercados españoles (Madrid). Usuarios: dos personas (uso personal).

## Stack (todo gratuito, no proponer nada de pago)
- Next.js 16 (App Router, TypeScript, Tailwind v4), desplegado en Vercel.
  - OJO: en Next 16 el middleware se llama `proxy.ts` (no `middleware.ts`).
- Supabase (Postgres + Auth magic link) como base de datos y login.
  Esquema en `supabase/schema.sql` (idempotente, se pega en el SQL Editor).
  Clientes en `lib/supabase/client.ts` (navegador) y `lib/supabase/server.ts` (servidor).
- Ingesta de precios: script Python en `ingest/` que corre en GitHub Actions cada día
  y carga datos en Supabase con la service_role key. Fuente: dataset Parquet diario
  de "opencesta" (github.com/ruvelro/opencesta), Mercadona zona "mad1" y Dia.
- Sin LLM por ahora. Sin servicios de pago.

## Principios
- Móvil primero. Interfaz en español, simple, grande, sin adornos. Tailwind plano,
  sin librerías de componentes.
- Guardar siempre precio por unidad (€/kg, €/L) además del precio del envase.
- Cambios pequeños y verificables. No refactorizar lo que no se pida.
- Al terminar cada tarea, decir exactamente qué comando ejecutar o qué abrir para comprobarlo.
- Un commit por iteración.

## Variables de entorno
Ver `.env.local.example`. `.env.local` nunca se sube al repo.
`SUPABASE_SERVICE_ROLE_KEY` solo la usa el script de ingesta, nunca el frontend.
