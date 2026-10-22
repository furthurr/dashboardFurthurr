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
- El build de Pages no despliega Edge Functions, migraciones ni ajustes de Auth. Las instalaciones existentes aplican `202610190001_user_administration.sql`, `202610200001_task_assignments.sql`, `202610200002_shared_task_editing.sql`, `202610210001_boards.sql`, `202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql` en orden; no se reejecuta el bootstrap completo (`supabase/README.md`). En una instalación sin `202610220002_board_lifecycle.sql` la UI de selección no es compatible con la base: el listado por RPC `list_boards_with_pending_counts` falla, el renombrado y la activación/desactivación no tienen RPC y no existe la columna `boards.is_active`. El proyecto Supabase remoto de este repositorio **sí** la tiene aplicada (ver el punto siguiente).
- `supabase/config.toml` declara `auth.enable_signup = false` y `functions.admin-users.verify_jwt = false`; el segundo ajuste requiere la validación explícita implementada dentro de la función. Se conserva la confirmación global de correo: el alta administrativa confirma cada cuenta con `email_confirm: true`. El estado remoto se verificó el 2026-10-22: `supabase config diff` informa **0 cambios que aplicar** (`update: 0`) y `auth.enable_signup` no aparece en la diferencia —el registro público ya está deshabilitado en remoto—, mientras que `functions list` confirma `verify_jwt: false` para `admin-users`, tal como declara el repo. Las 10 diferencias que reporta el diff son propiedades «solo remotas» (site_url, correo, MFA, pooler, storage vector) que `config push` conservaría y que no requieren ninguna acción.
- La secuencia de migraciones, incluida la de tableros, se aplicó al proyecto Supabase seleccionado y los probes remotos finalizaron con `PASS`. El 2026-10-22 se aplicaron además, en orden, `202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql`, y se volvieron a pasar las tres suites remotas (`boards.sql`, `task_assignments.sql`, `user_access.sql`) revirtiendo fixtures con `ROLLBACK`; el proyecto conserva sus 4 tableros y sus 32 tareas, con `is_active = true` en todos. Esta versión **ya se publicó en Pages** con `v0.6.0` el 2026-10-22 (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`, conclusión `success`), servida en <https://furthurr.github.io/dashboardFurthurr/>. También se ejecutaron probes locales con PostgreSQL embebido y Auth/Storage simulados.
- Las migraciones `202610220001` y `202610220002` **están aplicadas en el proyecto Supabase remoto** (2026-10-22, en ese orden), por lo que el contrato remoto ya es compatible con la UI del ciclo de vida. La verificación local previa usó PostgreSQL 16 en Docker con Auth/Storage simulados; la verificación posterior fue remota, contra el proyecto real. La publicación de la SPA ya no está pendiente; el baseline Git es `v0.6.0` / `21a44df`, con `main` sincronizada con `origin/main`.
- Estado verificado del despliegue remoto (2026-10-22): el redeploy de la Edge Function `admin-users` (acción `promote-admin` de `v0.5.0`) se realizó con `supabase functions deploy admin-users` y quedó en **versión 4, ACTIVE**, con el código remoto **idéntico byte a byte** al del repo (`supabase functions download admin-users`); el código desplegado anterior, versión 3, **no contenía** esa acción. `supabase config diff` informa **0 cambios que aplicar** (`update: 0`), con `auth.enable_signup` ya deshabilitado en remoto y `verify_jwt: false` confirmado por `functions list`. **Ya no queda pendiente de despliegue.** Siguen vigentes los límites: no hay E2E con cuentas reales ni auditoría de accesibilidad, y la verificación funcional de `promote-admin` en producción no se ha ejecutado con una sesión real de administrador (la comprobación fue de equivalencia de código desplegado y de rechazo sin sesión: 401 con `{"error":"Inicia sesión para continuar."}`).

## Higiene

- No añadir valores reales a este documento, a `.data/` ni a ejemplos versionados.
- No leer ni copiar el contenido de `.env.local`.
- Los nombres son coherentes con la inicialización real del cliente y el workflow; no usar `VITE_SUPABASE_KEY` (`src/lib/supabase.ts:3-10`).
