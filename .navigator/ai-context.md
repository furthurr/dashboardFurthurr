# Dashboard Furthurr

## Propósito

- **Qué es:** SPA Kanban con tableros de acceso por membresía, tareas, cuentas, comentarios, adjuntos y responsables múltiples, más un MCP remoto de identidad para agentes de desarrollo.
- **Alcance:** web estática en GitHub Pages y backend gestionado en Supabase: Auth/OAuth/Postgres/Storage, Edge Functions `admin-users` y `mcp`, y RPCs transaccionales. No hay servidor independiente ni SSR.

## Stack

- Lenguajes y frameworks: TypeScript, React 19, Vite 8, Tailwind CSS v4.
- Datos: Supabase Auth, PostgreSQL y Storage; TanStack Query para caché; dnd-kit para ordenar tareas.
- Build: `npm ci`; `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.
- Entrypoints: `src/main.tsx` → `src/App.tsx`; backend MCP `supabase/functions/mcp/index.ts`.

## Mapa rápido

- `src/features/auth/` → login, sesión, perfil activo, rutas protegidas, consentimiento OAuth MCP y gestión/revocación de conexiones.
- `src/features/users/` → gestión para admins: listado, alta, nombre, contraseña, estado, promoción a admin y cambio de avatares (`UsersPage.tsx`, `avatarApi.ts`, `api.ts`).
- `src/features/boards/` → selector con secciones activa/desactivada, creación, gestión de miembros, renombrado, activar/desactivar y eliminación permanente de tableros inactivos; autorización de rutas y RPCs en `api.ts`.
- `src/features/board/` → Kanban de un tablero, alta rápida de tareas, comentarios/adjuntos, traslados y `AssigneePicker`; APIs locales de tareas y adjuntos. El alta y el detalle permiten pegar imágenes; `ProfileAvatar` muestra avatares de asignados/autores.
- `src/shared/ui/` → `Dialog`, `Toast`, menú de cuenta y `ProfileAvatar` reutilizable.
- `src/lib/` → cliente Supabase y validación de variables en `supabase.ts`; `storage.ts` deriva el path de objetos `task-attachments` desde su URL de metadata.
- `src/types/index.ts` → tipos compartidos de perfiles, tableros (`Board.is_active`, `Board.pending_count`) y tareas (`Task.board_id`).
- `src/index.css` → estilos globales y variables visuales, incluida la clase del CTA flotante `.board-create-fab`.
- `supabase-schema.sql` → tablas, policies, buckets, vistas y grants de referencia; incluye `boards.is_active`, RPCs de ciclo de vida/borrado, permiso de cambio de `task_attachments.file_name` y policies del bucket público de avatares.
- `supabase/functions/admin-users/` → operaciones administrativas privilegiadas verificadas en servidor; rechaza tokens OAuth antes de acceder a perfiles. El remoto actual está en versión 6 ACTIVE.
- `supabase/functions/mcp/` → resource server Streamable HTTP con validación de firma/issuer/audience/sesión y una herramienta `whoami`. OAuth usa el rol Postgres `mcp_identity` limitado a identidad; no comparte permisos de negocio ni reenvía tokens.
- `mcp/README.md` → selector de instalación. Presets project-scoped por cliente: `opencode.json`, `.kiro/settings/mcp.json`, `.vscode/mcp.json`, `.mcp.json`, `.agents/mcp_config.json` y `.pi/mcp.json`; Claude Desktop requiere configuración manual desde su UI.
- `supabase/migrations/` → estado/grants, RPCs de negocio, membresía/ciclo de vida y MCP (`202610280002_mcp_identity.sql`). Ledger remoto: `202610190001`–`202610220001` y `202610280002`; objetos de `202610220002`, `202610260003`, `202610280001` existen sin entrada, mientras la policy `202610260001` y RPC `202610260002` no se encontraron. Reconciliar en `supabase/README.md` y `.data/04-schema.md` antes de aplicar SQL.
- Detalle y dependencias: [`module-map.json`](module-map.json).

## Convenciones

- Usa `HashRouter`; GitHub Pages no reescribe rutas internas y Vite publica bajo `/dashboardFurthurr/`.
- `/boards` exige cuenta activa y presenta solo tableros autorizados por RLS; `/board/:boardId` comprueba el acceso antes de cargar tareas; `/board` redirige a `/boards`. `/users` añade rol admin; `/register` redirige a `/users`; `/profile` y cuenta desde `AccountMenu`.
- Cualquier cuenta activa, incluidos invitados, puede guardar responsables por separado y editar/mover cualquier tarea de un tablero accesible, sea propia o ajena. Crear tareas sigue reservado a admin/usuario; borrar, a quien creó la tarea o a un admin. No confundir la edición compartida con la creación ni con el borrado.
- El tablero ofrece «+ Nueva Tarea» en la barra y un CTA flotante «Crear tarea» para cuentas no invitadas. En el formulario de alta, Ctrl+V / ⌘+V añade imágenes a la selección y se suben al crear la tarea; en la pestaña «Adjuntos» del detalle, pegar una imagen inicia la subida inmediata. Ambas vistas mantienen el máximo de 5 MB y no interceptan pegado de texto (`src/features/board/BoardPage.tsx:337-345,467-479`, `src/features/board/CreateTaskModal.tsx:45-75`, `src/features/board/TaskDetailModal.tsx:109-141`).
- El acceso es por membresía explícita: admin activo ve todos los tableros; los demás solo los asignados y activos. Ser responsable de tarea no concede acceso. Solo admin crea tableros y gestiona miembros; el traslado requiere acceso a origen y destino.
- Ciclo de vida de tableros: solo admin activo renombra, activa/desactiva o elimina. Desactivar conserva contenido/membresías y revoca acceso de miembros; el administrador puede reactivar. La acción de borrado local sólo acepta tableros desactivados y es permanente; el cliente limpia primero objetos Storage y luego llama a `delete_inactive_board`. En el proyecto remoto consultado esa RPC no estaba presente y el árbol local sin commit traduce `PGRST202` a ayuda de despliegue (`src/features/boards/BoardsPage.tsx`, `supabase/migrations/202610260002`).
- Gestión de adjuntos: uploader, creador de la tarea o admin activo, con acceso al tablero, puede renombrar `file_name` o borrar objeto + metadata. La migración local `202610260001` no se comprobó en remoto.
- Avatares: bucket público `avatars`; propietario o admin activo puede escribir. Se admiten JPG/PNG/WebP hasta 2 MiB y el perfil conserva `avatar_url`; aplicación remota de la migración `202610260003` no verificada.
- El catálogo de tableros se obtiene por RPC `list_boards_with_pending_counts`; la visibilidad la aplica esa RPC replicando RLS, no el cliente. El badge «Tareas pendientes» suma `backlog`, `por_hacer` y `haciendo`.
- OAuth MCP devuelve únicamente `id`, `email`, `full_name`, `role` y `client_id`; `whoami` requiere perfil activo y sesión OAuth viva. La salida contiene PII y debe mantenerse fuera de logs/compartición.
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
- `HEAD` consultado: `267cc910b2f5623f3b9e1ee3d86f3bfebd2c40e`. La documentación de este índice se sincroniza localmente y no está incluida en ese commit.
- Estado remoto MCP (2026-10-28): `mcp` versión 2 ACTIVE, `admin-users` versión 6 ACTIVE, migration `202610280002` aplicada, Auth OAuth/DCR/hook habilitados y Pages run `40796012117` publicado con `267cc91`. OpenCode Desktop ejecutó `whoami` bajo el alias anterior `furthurr`; el alias renombrado `dashboardFurthurr` puede requerir reautorización. Los otros clientes no están validados en este entorno.
- El árbol de trabajo conserva cambios locales ajenos en `src/features/boards/`, `.sdd/specs/mcp-integracion-ia/` y `pnpm-lock.yaml`; no se atribuyen a `HEAD`. `.sdd/` no se leyó ni sincronizó.

## Meta

- Actualizado: 2026-10-28, con MCP/OAuth, instalación multi-cliente y estado remoto; timestamp generado en UTC.
- Source commit: `267cc910b2f5623f3b9e1ee3d86f3bfebd2c40e` (baseline comprometido; esta sincronización documental queda sin commit).
- `HEAD` consultado: `267cc910b2f5623f3b9e1ee3d86f3bfebd2c40e`; remote Supabase/Pages se consultó esta sesión y su fecha/alcance están en las fuentes de datos/arquitectura.
- Commit base de implementación: `eb25418de42c045d6be32a3091f8bb3f36b24ba0`.
- MCP/Pages actual: OAuth/DCR y hook activos; `202610280002` aplicada; `mcp` v2 y `admin-users` v6 ACTIVE; Pages run `40796012117`, commit `267cc91`. La respuesta real de `whoami` se verificó en OpenCode Desktop con el alias anterior. El alias `dashboardFurthurr` requiere reautorización; otros clientes no están validados.
- Límites que siguen vigentes: **no hay E2E automatizado con cuentas reales ni auditoría de accesibilidad**, y la verificación funcional de `promote-admin` en producción fue **manual, no automatizada** (la persona responsable del proyecto confirmó el 2026-10-22 que el botón «Hacer administrador» de «Usuarios» promueve correctamente la cuenta con una sesión real de administrador). El resto de la UI sigue sin comprobarse contra el servicio real.
- Navigator root: `.`
- Capas 0–1 actualizadas; símbolos/grafo deshabilitados y `config.yaml` conservado. Por el límite efectivo de escritura del host, root `README.md`, `supabase/README.md` y `specs/` no pudieron sincronizarse; no afirmar que la documentación esté completa hasta resolver esos bloqueos.
