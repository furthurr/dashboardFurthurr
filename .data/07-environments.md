# Entornos y configuración

La aplicación valida que las variables de Supabase existan al inicializar el cliente (`src/lib/supabase.ts:3-10`). Los siguientes valores son placeholders de formato, no credenciales ni URLs reales.

| Variable | Uso | Local | CI / despliegue |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Configurar en entorno local como `https://<project-ref>.supabase.co` | GitHub Actions la pasa al build desde el secreto homónimo (`.github/workflows/deploy.yml:33-37`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publishable del cliente | Configurar en entorno local como `<publishable-key>` | GitHub Actions la pasa al build desde el secreto homónimo (`.github/workflows/deploy.yml:33-37`) |

Solo servidor Edge, nunca en el build Vite:

| Variable | Uso | Configuración |
| --- | --- | --- |
| `SUPABASE_URL` | Proyecto que usa `admin-users` | Entorno de funciones Supabase; `<project-url>` |
| `SUPABASE_SERVICE_ROLE_KEY` | API administrativa/Auth y perfiles | Secreto del entorno servidor; `<server-secret>`, nunca `VITE_*` |

Fuente: `supabase/functions/admin-users/index.ts:20-23`. Los placeholders no representan valores desplegados.

## Build/deploy observado

- Instalación reproducible por `npm ci` y build mediante `npm run build` (`.github/workflows/deploy.yml:24-37`).
- El build sube `dist` como artefacto de GitHub Pages (`.github/workflows/deploy.yml:39-53`).
- El prefijo de hosting está fijado en `vite.config.ts:6-13`.
- El repositorio no permite verificar si los secretos están configurados en GitHub ni qué proyecto Supabase corresponde a cada entorno.
- El build de Pages no despliega Edge Functions, migraciones ni ajustes de Auth. Las instalaciones existentes aplican `202610190001_user_administration.sql`, `202610200001_task_assignments.sql`, `202610200002_shared_task_editing.sql` y `202610210001_boards.sql` en orden; no se reejecuta el bootstrap completo (`supabase/README.md`). Sin la última migración, la UI de selección/membresías no es compatible con la base remota.
- `supabase/config.toml` declara `auth.enable_signup = false` y `functions.admin-users.verify_jwt = false`; el segundo ajuste requiere la validación explícita implementada dentro de la función. Se conserva la confirmación global de correo: el alta administrativa confirma cada cuenta con `email_confirm: true`.
- La migración de tableros no se aplicó ni verificó contra Supabase remoto; tampoco se comprobó publicación de esta versión de la SPA en Pages. Evidencia SQL disponible es local con PostgreSQL embebido y servicios Auth/Storage simulados.

## Higiene

- No añadir valores reales a este documento, a `.data/` ni a ejemplos versionados.
- No leer ni copiar el contenido de `.env.local`.
- Los nombres son coherentes con la inicialización real del cliente y el workflow; no usar `VITE_SUPABASE_KEY` (`src/lib/supabase.ts:3-10`).
