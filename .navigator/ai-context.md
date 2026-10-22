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
- `supabase/functions/admin-users/` → operaciones administrativas privilegiadas verificadas en servidor, incluida la promoción de rol a admin.
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
- Migración `supabase/migrations/202610210001_boards.sql`: aplicada al proyecto Supabase elegido para Pages; tareas/cuentas activas existentes se asignaron a Offline y General empezó vacío. La SPA aún no está desplegada.
- `202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql` están en el árbol de trabajo **sin commit**, pero **aplicadas el 2026-10-22 en el proyecto Supabase remoto**, en ese orden; las tres suites SQL remotas (`boards.sql`, `task_assignments.sql`, `user_access.sql`) pasan y revierten sus fixtures con `ROLLBACK`. La SPA compatible aún no está publicada en GitHub Pages.
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
- El working tree contiene cambios locales de producto/documentación; no se asigna `source_commit` hasta que exista un baseline Git verificable.

## Meta

- Actualizado: 2026-10-22, ciclo de vida de tableros (renombrado, activar/desactivar, tareas pendientes) con sus RPCs y policies, y en la misma fecha la aplicación verificada de `202610220001`/`202610220002` en el proyecto Supabase remoto; documentación sigue pendiente de baseline Git y la SPA compatible sigue sin publicar en Pages.
- Source commit: omitido; working tree con cambios locales no incluidos en `HEAD`.
- `HEAD` actual: `b42a4d2fd6b1eebae82305eb4aa3402e995078c5` (2026-10-22, `chore(release): preparar versión v0.5.0`); no incluye el ciclo de vida de tableros. El árbol de trabajo tiene 31 archivos modificados y 2 migraciones sin trackear.
- Commit base de implementación: `eb25418de42c045d6be32a3091f8bb3f36b24ba0`; el estado operativo de Supabase y la release preparada después siguen sin commit.
- Cambios concurrentes `ProfilePage`/`AccountMenu`: localizados para evitar rutas obsoletas; comportamiento completo y nuevas pruebas no sincronizados ni validados aquí.
- Navigator root: `.`
- Actualizado con: documentation-orchestrator, capas 0–1; símbolos y grafo permanecen deshabilitados. `config.yaml` se conservó.
