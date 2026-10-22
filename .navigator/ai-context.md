# Dashboard Furthurr

## Propósito

- **Qué es:** SPA Kanban con tableros de acceso por membresía, tareas, cuentas, comentarios, adjuntos y responsables múltiples.
- **Alcance:** web estática en GitHub Pages más backend gestionado en Supabase: Auth/Postgres/Storage, Edge Function administrativa y RPCs transaccionales. No hay servidor independiente ni SSR.

## Stack

- Lenguajes y frameworks: TypeScript, React 19, Vite 8, Tailwind CSS v4.
- Datos: Supabase Auth, PostgreSQL y Storage; TanStack Query para caché; dnd-kit para ordenar tareas.
- Build: `npm ci`; `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.
- Entrypoints: `src/main.tsx` → `src/App.tsx`.

## Mapa rápido

- `src/features/auth/` → login, sesión, perfil activo y rutas protegidas.
- `src/features/users/` → gestión para admins: listado, alta, nombre, contraseña, estado y promoción de cuentas no admin a admin.
- `src/features/boards/` → selector con secciones activa/desactivada, creación, gestión de miembros, renombrado y activar/desactivar; autorización de rutas; contratos de tableros/RPC en `api.ts`.
- `src/features/board/` → Kanban de un tablero, tareas/comentarios/adjuntos, traslados y `AssigneePicker`; APIs locales de tareas y adjuntos.
- `src/shared/ui/` → Dialog/Toast y controles de cuenta compartidos.
- `src/lib/supabase.ts` → cliente Supabase y validación de variables requeridas.
- `src/types/index.ts` → tipos compartidos de perfiles, tableros (`Board.is_active`, `Board.pending_count`) y tareas (`Task.board_id`).
- `src/index.css` → estilos globales y variables visuales.
- `supabase-schema.sql` → tablas, policies, buckets, vistas y grants de referencia; ya incluye `boards.is_active` y las RPCs de ciclo de vida.
- `supabase/functions/admin-users/` → operaciones administrativas privilegiadas verificadas en servidor, incluida la promoción de rol a admin; desplegada en el proyecto Supabase remoto en **versión 4, ACTIVE** (2026-10-22) con código **idéntico byte a byte** al del repo. La promoción a administrador se comprobó además **en producción el 2026-10-22** con una sesión real de administrador: la persona responsable del proyecto confirmó que el botón «Hacer administrador» de «Usuarios» funciona correctamente (comprobación manual, no automatizada).
- `supabase/migrations/` → estado/grants, RPCs de tareas y aislamiento por membresía; `202610210001_boards.sql` es requerido por el nuevo frontend y `202610220001`/`202610220002` por el ciclo de vida de tableros (aplicadas el 2026-10-22 en el proyecto Supabase remoto). `supabase/README.md` explica despliegue/pruebas SQL.
- Detalle y dependencias: [`module-map.json`](module-map.json).

## Convenciones

- Usa `HashRouter`; GitHub Pages no reescribe rutas internas y Vite publica bajo `/dashboardFurthurr/`.
- `/boards` exige cuenta activa y presenta solo tableros autorizados por RLS; `/board/:boardId` comprueba el acceso antes de cargar tareas; `/board` redirige a `/boards`. `/users` añade rol admin; `/register` redirige a `/users`; `/profile` y cuenta desde `AccountMenu`.
- Cualquier cuenta activa, incluidos invitados, puede guardar responsables por separado y editar/mover cualquier tarea de un tablero accesible, sea propia o ajena. Crear tareas sigue reservado a admin/usuario; borrar, a quien creó la tarea o a un admin. No confundir la edición compartida con la creación ni con el borrado.
- El acceso es por membresía explícita: admin activo ve todos los tableros; los demás solo los asignados y activos. Ser responsable de tarea no concede acceso. Solo admin crea tableros y gestiona miembros; el traslado requiere acceso a origen y destino.
- Ciclo de vida de tableros: solo admin activo renombra o activa/desactiva. `boards.is_active` desactiva sin borrar tareas, comentarios, adjuntos ni membresías; mientras está desactivado sus miembros dejan de verlo y de acceder a sus tareas (también por URL), pero el admin activo conserva el acceso y puede reactivarlo. Un tablero desactivado no es destino de traslado.
- El catálogo de tableros se obtiene por RPC `list_boards_with_pending_counts`; la visibilidad la aplica esa RPC replicando RLS, no el cliente. El badge «Tareas pendientes» suma `backlog`, `por_hacer` y `haciendo`.
- Anti-recursión: la policy de lectura de `boards` no invoca funciones que lean `boards`; `INSERT ... RETURNING` de PostgREST evalúa esa policy y una llamada de ese tipo provocaría recursión infinita.
- Migración `supabase/migrations/202610210001_boards.sql`: aplicada al proyecto Supabase elegido para Pages; tareas/cuentas activas existentes se asignaron a Offline y General empezó vacío. La SPA con este contrato está publicada en GitHub Pages.
- `202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql` están versionadas en el release `v0.6.0` (commit `21a44df`) y **aplicadas el 2026-10-22 en el proyecto Supabase remoto**, en ese orden; las tres suites SQL remotas (`boards.sql`, `task_assignments.sql`, `user_access.sql`) pasan y revierten sus fixtures con `ROLLBACK`. La SPA compatible **ya está publicada en GitHub Pages** con `v0.6.0` el 2026-10-22 (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`), servida en <https://furthurr.github.io/dashboardFurthurr/>.
- `specs/` conserva requisitos/intención de producto; actualiza la spec antes de implementar funcionalidad.
- Contrasta cambios de persistencia con `supabase-schema.sql` y la matriz de `specs/05-auth-roles-permisos.md`.
- Verifica comportamiento en el código y contratos: los índices de Navigator son orientación, no fuente de verdad.

## Docs y contexto externo

- `README.md` — onboarding, configuración local, scripts y rutas.
- `AGENTS.md` — instrucciones del proyecto y mapa documental; su sección `Folder Structure` histórica puede diferir del código actual.
- `.architecture/README.md` — arquitectura implementada y ADRs.
- `.data/README.md` — operaciones de Supabase, modelos y schema observado.
- `.design/README.md` — fundamentos visuales y componentes.
- `specs/README.md` — especificaciones SDD y estado de producto.
- `.sdd/` — workflow externo observado en el worktree; no leído ni sincronizado en esta operación.
- `arquitectura.md` — enlace legado a `.architecture/README.md`.
- `.quality/` y `.security/` — no inicializadas en esta sincronización; no implican auditoría de esos dominios.

## Riesgos y restricciones

- Nunca usar claves privilegiadas en la SPA. La Edge Function usa su entorno servidor; RLS/grants y comprobaciones Edge/RPC autorizan acciones, no la UI. `is_active` no invalida criptográficamente JWTs ni archivos ya descargados.
- No indexar ni copiar `.env`, `.env.*`, credenciales o datos personales. Variables permitidas por nombre: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; no registrar sus valores.
- La policy de lectura de `boards` es sensible: no debe invocar funciones que lean `boards` (recursión RLS en `INSERT ... RETURNING`).
- El baseline Git es verificable (`v0.6.0` / `21a44df`); el árbol de trabajo solo contiene la actualización documental de este ciclo, sin cambios de producto ni migraciones sin trackear, y `source_commit` (`daa40fd`) no incluye ese contenido sin commit.

## Meta

- Actualizado: 2026-10-22, **cierre de la verificación funcional de `promote-admin`** (la promoción a administrador desde «Usuarios» se confirmó en producción con una sesión real de administrador), cierre de los dos pendientes de despliegue (redeploy verificado de `admin-users` en versión 4 con código idéntico al repo; `config diff` con `update: 0` y `auth.enable_signup` ya deshabilitado en remoto), ciclo de vida de tableros (renombrado, activar/desactivar, tareas pendientes) con sus RPCs y policies, la aplicación verificada de `202610220001`/`202610220002` en el proyecto Supabase remoto y la publicación de la SPA con `v0.6.0` en GitHub Pages. El baseline Git ya no está pendiente.
- Source commit: `daa40fdd6b1ff75dccf0d6ecd10b4d54c443d5b0` (2026-10-22, `docs(canonica): registrar el cierre de los pendientes de despliegue`), sobre el release `v0.6.0` (`21a44df`). `main` está sincronizada con `origin/main` en ese commit.
- `HEAD` actual: `daa40fdd6b1ff75dccf0d6ecd10b4d54c443d5b0` (2026-10-22, `docs(canonica): registrar el cierre de los pendientes de despliegue`), sobre el release `v0.6.0` (`21a44df`); **incluye** el ciclo de vida de tableros, sus migraciones, la documentación y el registro del redeploy de `admin-users` y de la configuración de Auth remota. El árbol de trabajo solo contiene la actualización documental de este ciclo (cierre de la verificación funcional de `promote-admin`), pendiente de commit: no hay cambios de producto ni migraciones sin trackear.
- Commit base de implementación: `eb25418de42c045d6be32a3091f8bb3f36b24ba0`.
- El redeploy de la Edge Function `admin-users` (acción `promote-admin` de `v0.5.0`) y la configuración de Auth remota (`supabase/config.toml`) **ya no están pendientes**: se verificaron el 2026-10-22 en el proyecto Supabase remoto (función en **versión 4, ACTIVE**, con el código descargado del remoto **idéntico byte a byte** al del repo; `supabase config diff` con **0 cambios aplicables** —`update: 0`—, `auth.enable_signup` ya deshabilitado en remoto y `functions list` confirmando `verify_jwt: false`).
- Límites que siguen vigentes: **no hay E2E automatizado con cuentas reales ni auditoría de accesibilidad**, y la verificación funcional de `promote-admin` en producción fue **manual, no automatizada** (la persona responsable del proyecto confirmó el 2026-10-22 que el botón «Hacer administrador» de «Usuarios» promueve correctamente la cuenta con una sesión real de administrador). El resto de la UI sigue sin comprobarse contra el servicio real.
- Cambios concurrentes `ProfilePage`/`AccountMenu`: localizados para evitar rutas obsoletas; comportamiento completo y nuevas pruebas no sincronizados ni validados aquí.
- Navigator root: `.`
- Actualizado con: documentation-orchestrator, capas 0–1; símbolos y grafo permanecen deshabilitados. `config.yaml` se conservó.
