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
- `src/features/users/` → gestión para admins: listado, alta, nombre, contraseña, estado, promoción a admin y cambio de avatares (`UsersPage.tsx`, `avatarApi.ts`, `api.ts`).
- `src/features/boards/` → selector con secciones activa/desactivada, creación, gestión de miembros, renombrado, activar/desactivar y eliminación permanente de tableros inactivos; autorización de rutas y RPCs en `api.ts`.
- `src/features/board/` → Kanban de un tablero, alta rápida de tareas, comentarios/adjuntos, traslados y `AssigneePicker`; APIs locales de tareas y adjuntos. El alta y el detalle permiten pegar imágenes; `ProfileAvatar` muestra avatares de asignados/autores.
- `src/shared/ui/` → `Dialog`, `Toast`, menú de cuenta y `ProfileAvatar` reutilizable.
- `src/lib/` → cliente Supabase y validación de variables en `supabase.ts`; `storage.ts` deriva el path de objetos `task-attachments` desde su URL de metadata.
- `src/types/index.ts` → tipos compartidos de perfiles, tableros (`Board.is_active`, `Board.pending_count`) y tareas (`Task.board_id`).
- `src/index.css` → estilos globales y variables visuales, incluida la clase del CTA flotante `.board-create-fab`.
- `supabase-schema.sql` → tablas, policies, buckets, vistas y grants de referencia; incluye `boards.is_active`, RPCs de ciclo de vida/borrado, permiso de cambio de `task_attachments.file_name` y policies del bucket público de avatares.
- `supabase/functions/admin-users/` → operaciones administrativas privilegiadas verificadas en servidor, incluida la promoción a admin; el listado local proyecta `avatar_url`. El despliegue en versión 4 ACTIVE y la verificación funcional de `promote-admin` corresponden al registro remoto del 2026-10-22; no se consultó remoto en esta sincronización.
- `supabase/migrations/` → estado/grants, RPCs de tareas, membresía y ciclo de vida. Las migraciones locales `202610260001_task_attachment_management.sql`, `202610260002_delete_inactive_boards.sql` y `202610260003_profile_avatars.sql` documentan contratos nuevos; no se verificó su aplicación remota. `supabase/README.md` es la guía operativa.
- Detalle y dependencias: [`module-map.json`](module-map.json).

## Convenciones

- Usa `HashRouter`; GitHub Pages no reescribe rutas internas y Vite publica bajo `/dashboardFurthurr/`.
- `/boards` exige cuenta activa y presenta solo tableros autorizados por RLS; `/board/:boardId` comprueba el acceso antes de cargar tareas; `/board` redirige a `/boards`. `/users` añade rol admin; `/register` redirige a `/users`; `/profile` y cuenta desde `AccountMenu`.
- Cualquier cuenta activa, incluidos invitados, puede guardar responsables por separado y editar/mover cualquier tarea de un tablero accesible, sea propia o ajena. Crear tareas sigue reservado a admin/usuario; borrar, a quien creó la tarea o a un admin. No confundir la edición compartida con la creación ni con el borrado.
- El tablero ofrece «+ Nueva Tarea» en la barra y un CTA flotante «Crear tarea» para cuentas no invitadas. En el formulario de alta, Ctrl+V / ⌘+V añade imágenes a la selección y se suben al crear la tarea; en la pestaña «Adjuntos» del detalle, pegar una imagen inicia la subida inmediata. Ambas vistas mantienen el máximo de 5 MB y no interceptan pegado de texto (`src/features/board/BoardPage.tsx:337-345,467-479`, `src/features/board/CreateTaskModal.tsx:45-75`, `src/features/board/TaskDetailModal.tsx:109-141`).
- El acceso es por membresía explícita: admin activo ve todos los tableros; los demás solo los asignados y activos. Ser responsable de tarea no concede acceso. Solo admin crea tableros y gestiona miembros; el traslado requiere acceso a origen y destino.
- Ciclo de vida de tableros: solo admin activo renombra, activa/desactiva o elimina. Desactivar conserva contenido/membresías y revoca acceso de miembros; el administrador puede reactivar. La acción de borrado solo acepta tableros desactivados y es permanente; el cliente limpia primero objetos de adjuntos Storage y luego llama a `delete_inactive_board`, así que las fases no son atómicas (`src/features/boards/api.ts:69-145`, migración local `202610260002`).
- Gestión de adjuntos: uploader, creador de la tarea o admin activo, con acceso al tablero, puede renombrar `file_name` o borrar objeto + metadata. La migración local `202610260001` no se comprobó en remoto.
- Avatares: bucket público `avatars`; propietario o admin activo puede escribir. Se admiten JPG/PNG/WebP hasta 2 MiB y el perfil conserva `avatar_url`; aplicación remota de la migración `202610260003` no verificada.
- El catálogo de tableros se obtiene por RPC `list_boards_with_pending_counts`; la visibilidad la aplica esa RPC replicando RLS, no el cliente. El badge «Tareas pendientes» suma `backlog`, `por_hacer` y `haciendo`.
- Anti-recursión: la policy de lectura de `boards` no invoca funciones que lean `boards`; `INSERT ... RETURNING` de PostgREST evalúa esa policy y una llamada de ese tipo provocaría recursión infinita.
- Historial de despliegue (2026-10-21/22): `202610210001_boards.sql` y después `202610220001`/`202610220002` se aplicaron en el proyecto Supabase elegido; las cuentas/tareas existentes se asignaron a Offline y General inició vacío. Las suites SQL y publicación `v0.6.0` (run `39860177282`) son evidencia histórica, no prueban cambios posteriores.
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
- `HEAD` consultado: `bbacf5c62a8ab0bf144e602ae3666c4026882f0e`. El árbol contiene cambios sin commit en UI/APIs, schema, migraciones y documentación; esta referencia describe ese árbol observado, no atribuye esos cambios a `HEAD`. No se consultaron `main`/`origin/main` ni se verificó el remoto.
- La documentación del proyecto registra `v0.8.1` (run `40004615822`) como última publicación conocida; no se consultó Pages. Las migraciones locales `202610260001`–`202610260003` y los cambios de producto actuales no se presentan como desplegados.

## Meta

- Actualizado: 2026-10-27, con contexto local de adjuntos, borrado de tableros inactivos y avatares.
- Source commit: `bbacf5c62a8ab0bf144e602ae3666c4026882f0e` (baseline comprometido de `HEAD`; no incluye los cambios locales descritos aquí).
- `HEAD`: `bbacf5c62a8ab0bf144e602ae3666c4026882f0e`; referencias remotas no consultadas. El índice apunta al código actualmente observado en el árbol; las modificaciones de este archivo están sin commit.
- Commit base de implementación: `eb25418de42c045d6be32a3091f8bb3f36b24ba0`.
- El redeploy de la Edge Function `admin-users` (acción `promote-admin` de `v0.5.0`) y la configuración de Auth remota (`supabase/config.toml`) **ya no están pendientes**: se verificaron el 2026-10-22 en el proyecto Supabase remoto (función en **versión 4, ACTIVE**, con el código descargado del remoto **idéntico byte a byte** al del repo; `supabase config diff` con **0 cambios aplicables** —`update: 0`—, `auth.enable_signup` ya deshabilitado en remoto y `functions list` confirmando `verify_jwt: false`).
- Límites que siguen vigentes: **no hay E2E automatizado con cuentas reales ni auditoría de accesibilidad**, y la verificación funcional de `promote-admin` en producción fue **manual, no automatizada** (la persona responsable del proyecto confirmó el 2026-10-22 que el botón «Hacer administrador» de «Usuarios» promueve correctamente la cuenta con una sesión real de administrador). El resto de la UI sigue sin comprobarse contra el servicio real.
- Navigator root: `.`
- Actualizado con: documentation-orchestrator, capas 0–1; símbolos y grafo permanecen deshabilitados. `config.yaml` se conservó. `README.md`, las specs afectadas y `supabase/README.md` se actualizaron el 2026-10-27; no se verificó en remoto la aplicación de las migraciones locales.
