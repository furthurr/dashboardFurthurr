# Dashboard Furthurr

## Propósito

- **Qué es:** SPA Kanban con tableros de acceso por membresía, tareas, cuentas, comentarios, adjuntos y responsables múltiples, más un MCP remoto para agentes de desarrollo con identidad, consulta de tareas y workflow asistido.
- **Alcance:** web estática en GitHub Pages y backend gestionado en Supabase: Auth/OAuth/Postgres/Storage, Edge Functions `admin-users` y `mcp`, y RPCs transaccionales. No hay servidor independiente ni SSR.

## Stack

- Lenguajes y frameworks: TypeScript, React 19, Vite 8, Tailwind CSS v4.
- Datos: Supabase Auth, PostgreSQL y Storage; TanStack Query para caché; dnd-kit para ordenar tareas.
- Build: `npm ci`; `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.
- Entrypoints: `src/main.tsx` → `src/App.tsx`; backend MCP `supabase/functions/mcp/index.ts`.

## Mapa rápido

- `src/features/auth/` → login, sesión, perfil activo, rutas protegidas, consentimiento OAuth MCP, permisos de workflow por cliente y gestión/revocación de conexiones.
- `src/features/users/` → gestión para admins: listado, alta, nombre, contraseña, estado, promoción a admin y cambio de avatares (`UsersPage.tsx`, `avatarApi.ts`, `api.ts`).
- `src/features/boards/` → selector con secciones activa/desactivada, creación, gestión de miembros, renombrado, activar/desactivar y eliminación permanente de tableros inactivos; autorización de rutas y RPCs en `api.ts`. El borrado se delega en la Edge Function `board-delete` (sin fallback a Storage ni RPC).
- `src/features/board/` → Kanban de un tablero, alta rápida de tareas, comentarios/adjuntos, traslados y `AssigneePicker`; APIs locales de tareas y adjuntos. El alta y el detalle permiten pegar imágenes; `ProfileAvatar` muestra avatares de asignados/autores. Un tablero desactivado se monta en modo solo lectura (`readOnly`).
- `src/shared/ui/` → `Dialog`, `Toast`, menú de cuenta y `ProfileAvatar` reutilizable.
- `src/lib/` → cliente Supabase y validación de variables en `supabase.ts`; `storage.ts` deriva el path de objetos `task-attachments` desde su URL de metadata.
- `scripts/` → envoltorio de desarrollo local: `dev.mjs` elimina las variables Supabase heredadas antes de cargar Vite y `dev-environment.mjs` contiene esa lógica; `test-dev-environment.mjs` la verifica con `node --test`.
- `src/types/index.ts` → tipos compartidos de perfiles, tableros (`Board.is_active`, `Board.pending_count`) y tareas (`Task.board_id`).
- `src/index.css` → estilos globales y variables visuales, incluida la clase del CTA flotante `.board-create-fab`.
- `supabase-schema.sql` → tablas, policies, buckets, vistas y grants de referencia; incluye `boards.is_active`, RPCs de ciclo de vida/borrado, permiso de cambio de `task_attachments.file_name`, policies del bucket público de avatares y el aislamiento MCP (`mcp_workflow_permissions`, `mcp_task_operations`).
- `supabase/functions/admin-users/` → operaciones administrativas privilegiadas verificadas en servidor; rechaza tokens OAuth antes de acceder a perfiles. Versión 6 ACTIVE observada en remoto el 2026-10-28, no verificada de nuevo aquí.
- `supabase/functions/board-delete/` → borrado completo de tableros desactivados, **solo en servidor**. Verifica el bearer con `auth.getUser`, rechaza sesiones OAuth, exige admin activo y coordina `prepare_board_deletion` / `finish_board_deletion` (service-only) con la eliminación de objetos en Storage. **No desplegada** en remoto.
- `supabase/functions/mcp/` → resource server Streamable HTTP con validación de firma/issuer/audience/sesión y seis herramientas: `whoami`, `get_task`, `read_task_attachment`, `start_task`, `record_task_result` y `submit_task_for_review`. OAuth usa el rol Postgres `mcp_identity` limitado a identidad; no comparte permisos de negocio ni reenvía tokens.
- `mcp/README.md` → selector de instalación. Presets project-scoped por cliente: `opencode.json`, `.kiro/settings/mcp.json`, `.vscode/mcp.json`, `.mcp.json`, `.agents/mcp_config.json` y `.pi/mcp.json`; Claude Desktop requiere configuración manual desde su UI.
- `supabase/migrations/` → RPCs/policies y MCP (`202610280002` identidad, `202610280003` lectura legacy, `202610290001` workflow, `202610300001` automatización previa, `202610300002` consentimiento unificado local) y `202611060001_inactive_board_readonly.sql` (solo lectura de tableros inactivos + borrado solo-servidor, **publicada en `v0.16.0` y sin aplicar en remoto**). Antes de aplicar SQL contrasta objetos y ledger; el registro remoto incluye `202610290001` y la corrección focalizada `202610260002` del 2026-11-02.
- Detalle y dependencias: [`module-map.json`](module-map.json).

## Convenciones

- Usa `HashRouter`; GitHub Pages no reescribe rutas internas y Vite publica bajo `/dashboardFurthurr/`.
- `/boards` exige cuenta activa y presenta solo tableros autorizados por RLS; `/board/:boardId` comprueba el acceso antes de cargar tareas; `/board` redirige a `/boards`. `/users` añade rol admin; `/register` redirige a `/users`; `/profile` y cuenta desde `AccountMenu`.
- Cualquier cuenta activa, incluidos invitados, puede guardar responsables por separado y editar/mover cualquier tarea de un tablero accesible, sea propia o ajena. Crear tareas sigue reservado a admin/usuario; borrar, a quien creó la tarea o a un admin. No confundir la edición compartida con la creación ni con el borrado.
- El tablero ofrece «+ Nueva Tarea» en la barra y un CTA flotante «Crear tarea» para cuentas no invitadas. En el formulario de alta, Ctrl+V / ⌘+V añade imágenes a la selección y se suben al crear la tarea; en la pestaña «Adjuntos» del detalle, pegar una imagen inicia la subida inmediata. Ambas vistas mantienen el máximo de 5 MB y no interceptan pegado de texto (`src/features/board/BoardPage.tsx:337-345,467-479`, `src/features/board/CreateTaskModal.tsx:45-75`, `src/features/board/TaskDetailModal.tsx:109-141`).
- En el portal, admin activo ve todos los tableros; las demás cuentas activas pueden acceder a tableros activos por membresía o asignación de tarea. La asignación no crea membresía. Solo admin crea tableros y gestiona miembros; el traslado requiere acceso a origen y destino (`supabase/migrations/202610280001_board_assignment_access.sql:4-42`).
- Ciclo de vida de tableros: solo admin activo renombra, activa/desactiva o elimina. Desactivar conserva contenido/membresías y revoca acceso de miembros; el administrador puede reactivar. **Un tablero desactivado está en solo lectura para todos los roles, incluido el admin activo**: la garantía son policies restrictivas de escritura en Postgres/Storage y guardas `lock_writable_*` en las RPCs (`202611060001_inactive_board_readonly.sql`, publicada en `v0.16.0` y sin aplicar en remoto). El borrado es **solo en servidor** (`board-delete`); `delete_inactive_board` queda revocada y no hay fallback cliente. Un tablero con borrado pendiente no se puede reactivar.
- **Arranque local:** `npm run dev` ejecuta `scripts/dev.mjs`, que elimina `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del entorno heredado antes de cargar Vite (Vite prioriza esas variables sobre `.env.local`). No registra valores ni altera el shell padre.
- Gestión de adjuntos: uploader, creador de la tarea o admin activo, con acceso al tablero, puede renombrar `file_name` o borrar objeto + metadata. El editor conserva la última extensión desde `ba13bfe`; es una restricción de UI, no garantía SQL. La migración `202610260001` no se comprobó en remoto.
- Avatares: bucket público `avatars`; propietario o admin activo puede escribir. Se admiten JPG/PNG/WebP hasta 2 MiB y el perfil conserva `avatar_url`; aplicación remota de la migración `202610260003` no verificada.
- El catálogo de tableros se obtiene por RPC `list_boards_with_pending_counts`; la visibilidad la aplica esa RPC replicando RLS, no el cliente. El badge «Tareas pendientes» suma `backlog`, `por_hacer` y `haciendo`.
- El MCP es más estricto que el portal: exige asignación explícita de la tarea para cualquier rol, acceso al tablero y estado `backlog`, `por_hacer` o `haciendo`; no admin también requiere membresía. No reutilizar el helper del portal, que acepta acceso por asignación.
- El workflow MCP escribe solo por `mcp_work_task`: `start_task` (a `haciendo`), `record_task_result` (comentario en `haciendo`) y `submit_task_for_review` (a `en_revision`). `Finalizadas` y la reasignación son manuales; una tarea en revisión deja de ser accesible para el MCP. Cada mutación exige `updated_at` exacto y un `request_id` único.
- El consentimiento MCP local concede cinco permisos como conjunto con avance automático; solo se retiran revocando la conexión completa. No hay opt-in por tarea. Identidad OAuth sola no equivale a consentimiento de aplicación; scopes `email profile` son identidad, no permisos de datos.
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
- `docs/prueba-mcp.md` — preparación, activación y checklist de prueba del MCP.
- `docs/tableros-solo-lectura.md` — despliegue y checklist de tableros desactivados en solo lectura y borrado solo-servidor.
- `mcp/README.md` — selector e instalación OAuth por cliente.
- `supabase/README.md` — guía operativa de migraciones, pruebas SQL y despliegue.
- `specs/README.md` — especificaciones SDD y estado de producto.
- `.sdd/` — workflow externo; el plan MCP sin seguimiento se preserva sin sincronizar ni incorporar automáticamente.
- `arquitectura.md` — enlace legado a `.architecture/README.md`.
- `.quality/` y `.security/` — no inicializadas en esta sincronización; no implican auditoría de esos dominios.

## Riesgos y restricciones

- Nunca usar claves privilegiadas en la SPA. La Edge Function usa su entorno servidor; RLS/grants y comprobaciones Edge/RPC autorizan acciones, no la UI. `is_active` no invalida criptográficamente JWTs ni archivos ya descargados.
- No indexar ni copiar `.env`, `.env.*`, credenciales o datos personales. Variables permitidas por nombre: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; no registrar sus valores.
- La policy de lectura de `boards` es sensible: no debe invocar funciones que lean `boards` (recursión RLS en `INSERT ... RETURNING`).
- Estado remoto del MCP (2026-10-29): `mcp` Edge **v4 ACTIVE** (aplicación `0.3.0`, `verify_jwt=false`), `202610290001` aplicada y registrada, `202610280003` aplicada y registrada, `202610280002` aplicada y Auth OAuth/DCR/hook habilitados. Pages run `40963945319` publicó `0ebb61d` (`v0.13.0`) con conclusión `success`. El alias `dashboardFurthurr` puede requerir reautorización; los otros clientes no están validados en este entorno.
- El ledger remoto de migraciones no coincide con todos los objetos observados en el schema. Reconciliar en `.data/04-schema.md` y `supabase/README.md` antes de aplicar SQL; no ejecutar `db push` global.
- **Estado 2026-11-06 (publicado en `v0.16.0`, sin desplegar en Supabase):** `202611060001_inactive_board_readonly.sql` no está aplicada en remoto y `board-delete` no está desplegada. El push a `main` publica la SPA en GitHub Pages, pero Pages no despliega SQL ni Edge Functions: el entorno desplegado sigue admitiendo escrituras en tableros desactivados y conserva el borrado cliente. La migración no es idempotente: no reaplicarla ni restaurar los grants retirados.
- El workflow MCP deja rastro de cada mutación en `mcp_task_operations` con `payload` y resultado, sin política de retención definida. Retirar permisos o revocar la sesión no invalida comentarios ya escritos ni enlaces firmados emitidos.
- `.sdd/specs/mcp-integracion-ia/` estaba sin seguimiento al revisar; es un plan externo anterior, no un contrato del MCP implementado.

## Meta

- Actualizado: 2026-11-06, con tableros desactivados en solo lectura, borrado solo-servidor (`board-delete`) y protección del arranque local; timestamp generado en UTC.
- Source commit: `6b4f730390ca5d32e00c8efc18d60d0b035da841` (`docs(mcp): registrar activación del workflow en contratos y guías`). Es una marca histórica, no una auditoría global del índice.
- Revisión focalizada posterior sobre `f501082`: release `v0.14.0` y Pages run `41576684027` confirmados; incluyen la UI MCP, orientación `PGRST202` y extensión de adjuntos. No acreditan backend remoto ni E2E.
- Revisión incremental 2026-11-01 (2026-11-02 UTC): se ajustaron notas de OAuth, error de borrado y evidencia histórica en capas 0–1. No se ha regenerado todo el índice ni atribuido el árbol local a `HEAD`; la marca histórica no acredita vigencia global.
- Revisión focalizada 2026-11-02: se contrastaron adjuntos y el registro documental del borrado remoto; no se regeneró el mapa ni se acreditó vigencia global.
- **Revisión focalizada 2026-11-06:** se incorporaron `scripts/`, `supabase/functions/board-delete/` y la migración `202611060001` al mapa, y se actualizaron las convenciones de ciclo de vida y arranque local. Los cambios de código se publican en `v0.16.0` sobre `acf85d7` (`v0.15.0`); la marca `source_commit` sigue siendo histórica y no acredita vigencia global.
- Commit base de implementación: `eb25418de42c045d6be32a3091f8bb3f36b24ba0`.
- Límites que siguen vigentes: **no hay E2E automatizado con cuentas reales, ni verificación del consentimiento en navegador, ni auditoría de accesibilidad**. Una sesión anterior consultó e inició una tarea mediante MCP automático, pero no acredita lectura real de adjuntos ni el flujo completo hasta revisión. La verificación funcional de `promote-admin` en producción fue **manual, no automatizada** (confirmada por la persona responsable del proyecto el 2026-10-22).
- Publicación posterior a la release: Pages run `41578579605` terminó correctamente para `f0a4c9a`, commit solo documental; no acredita despliegue de Supabase ni E2E. La revisión de esta nota no regenera el índice global.
- Navigator root: `.`
- Capas 0–1 con revisiones focalizadas; símbolos/grafo deshabilitados y `config.yaml` conservado.
