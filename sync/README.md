# Optional encrypted sync / Sincronización cifrada opcional

## English

This Worker binds a GitHub account to an opaque HMAC subject and stores only encrypted
profile envelopes in D1. It is intentionally not deployed from the public build workflow.

Before deployment:

1. Create a dedicated custom origin for both the PWA and `/auth` + `/api` routes.
2. Register a GitHub App callback at `https://ORIGIN/auth/github/callback` with no account
   or repository permissions.
3. Copy `wrangler.example.jsonc` to `wrangler.jsonc`, create D1 and replace its ID.
   Keep the configured per-IP OAuth rate-limit binding; authentication fails closed without it.
4. Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and a random 256-bit-or-stronger
   `ACCOUNT_PEPPER_V1` with `wrangler secret put`; never commit them.
5. Apply `migrations/0001_initial.sql`, run the repository tests, then deploy explicitly.

Cloudflare dashboard login through GitHub does not create this GitHub App or its callback.

## Español

Este Worker vincula una cuenta GitHub a un sujeto HMAC opaco y solo guarda sobres de
perfil cifrados en D1. No se despliega desde el workflow público de build.

Antes del despliegue:

1. Crea un origen personalizado dedicado que sirva la PWA y las rutas `/auth` + `/api`.
2. Registra una GitHub App con callback `https://ORIGEN/auth/github/callback`, sin permisos
   de cuenta ni repositorio.
3. Copia `wrangler.example.jsonc` como `wrangler.jsonc`, crea D1 y sustituye su ID.
   Conserva el rate limit por IP configurado para OAuth; la autenticación falla de forma segura si falta.
4. Añade `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` y un `ACCOUNT_PEPPER` aleatorio de
   256 bits o más en `ACCOUNT_PEPPER_V1` mediante `wrangler secret put`; nunca los commitees.
5. Aplica `migrations/0001_initial.sql`, ejecuta las pruebas y despliega explícitamente.

Entrar al panel de Cloudflare mediante GitHub no crea esta GitHub App ni su callback.
