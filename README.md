# Compra

Menú semanal y lista de la compra con precios reales de Mercadona (Madrid) y Dia.

## Arrancar en local

```bash
cp .env.local.example .env.local   # rellena con Supabase → Settings → API
npm install
npm run dev                         # http://localhost:3000
```

## Base de datos

Pega en Supabase → SQL Editor, por este orden: `supabase/schema.sql` y `supabase/schema_menu.sql`.
Los dos son idempotentes.

## Precios

```bash
uv run --python 3.12 --with-requirements ingest/requirements.txt python ingest/ingest.py
```

Lo mismo corre cada día a las 12:00 UTC en GitHub Actions (`.github/workflows/ingest.yml`)
con los secrets `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

## Recetas

```bash
npx tsx scripts/seed_recipes.ts     # carga data/recipes.json
```

## Despliegue (Vercel)

1. Add New Project → importa el repo.
2. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy.
4. Supabase → Authentication → URL Configuration: añade `https://TU-APP.vercel.app` como
   Site URL y `https://TU-APP.vercel.app/**` en Redirect URLs. Sin esto el magic link no funciona.
5. Desde el móvil: "Añadir a pantalla de inicio".
