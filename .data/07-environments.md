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
- El build de Pages no despliega Edge Functions, migraciones ni ajustes de Auth. Para una instalación existente, la secuencia local completa es `202610190001_user_administration.sql` → `202610200001_task_assignments.sql` → `202610200002_shared_task_editing.sql` → `202610210001_boards.sql` → `202610220001_board_access_returning.sql` → `202610220002_board_lifecycle.sql` → `202610260001_task_attachment_management.sql` → `202610260002_delete_inactive_boards.sql` → `202610260003_profile_avatars.sql`; aplica solo las pendientes y no reejecutes el bootstrap. Esta secuencia también está descrita en `supabase/README.md`. La aplicación remota de las tres migraciones nuevas no se verificó ni se ejecutaron pruebas SQL en esta sincronización.
- `supabase/config.toml` declara `auth.enable_signup = false` y `functions.admin-users.verify_jwt = false`; la validación explícita está dentro de la función y el alta administrativa confirma la cuenta con `email_confirm: true`. La última comprobación remota documentada es del 2026-10-22 (`config diff` sin cambios aplicables y `verify_jwt: false`); no se volvió a consultar el remoto aquí.
- Historial SQL verificado el 2026-10-22: `202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql` se aplicaron en ese orden; las suites remotas `boards.sql`, `task_assignments.sql` y `user_access.sql` pasaron con fixtures revertidos mediante `ROLLBACK`. La SPA de ciclo de vida se publicó entonces como `v0.6.0` (run `39860177282`). Este registro es histórico, no una comprobación de los cambios locales actuales.
- Historial Edge/Auth verificado el 2026-10-22: `admin-users` quedó en versión 4 ACTIVE con código idéntico al repo; Auth no mostró cambios aplicables y el flujo `promote-admin` se confirmó manualmente en producción. No se repitieron esas verificaciones en esta sincronización.
- Estado de sincronización local 2026-10-26: las tres migraciones nuevas y los cambios de SPA están en el árbol de trabajo sin commit. La documentación del proyecto identifica `v0.8.1` (run `40004615822`) como la última publicación registrada; no se verificó por remoto que incluya cambios posteriores.

## Higiene

- No añadir valores reales a este documento, a `.data/` ni a ejemplos versionados.
- No leer ni copiar el contenido de `.env.local`.
- Los nombres son coherentes con la inicialización real del cliente y el workflow; no usar `VITE_SUPABASE_KEY` (`src/lib/supabase.ts:3-10`).
