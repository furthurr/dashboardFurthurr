# Arquitectura — Dashboard Furthurr

Documentación canónica de arquitectura. Lee este archivo antes de cambiar límites entre módulos, integración con Supabase, routing o despliegue.

## Estado de sincronización

- Tecnología detectada: SPA React 19/TypeScript 6/Vite 8, Supabase Auth/PostgreSQL/Storage, Edge Function administrativa y RPCs Postgres.
- Modo: `lite`.
- Commit base revisado: `81335b92bc1962a47c9c3bb963271c3667bc7b63` (2026-05-04). Es una referencia, no un baseline que incluya los cambios locales.
- Última actualización documental: 2026-10-21, incorporación local del modelo y flujo de tableros.
- Commit base de implementación y primera sincronización: `eb25418de42c045d6be32a3091f8bb3f36b24ba0`.
- Actualización operativa posterior: la migración de tableros y los tres probes SQL se aplicaron/pasaron en el proyecto Supabase elegido el 2026-10-21. Este registro de despliegue sigue pendiente de commit; no se declara sincronizado con HEAD.
- Alcance: selección post-login, gestión de membresías, autorización RLS por tablero, aislamiento de recursos y traslado atómico.

## Contexto para IA

- **Sistema:** dashboard Kanban estático en GitHub Pages; datos/Auth/Storage mediante Supabase JS. El repositorio también contiene backend desplegable en Supabase: `admin-users` para operaciones privilegiadas y funciones Postgres para tareas/asignaciones. No hay servidor de aplicación independiente ni SSR (`src/App.tsx:19-42`, `supabase/functions/admin-users/index.ts:13-80`).
- **Estilo:** features cliente `auth`, `boards`, `board` y `users`, providers globales y TanStack Query. Lecturas ordinarias acceden al SDK; las operaciones de autorización y traslado usan RPCs. No se documenta una capa de repositorios (`src/features/boards/api.ts`, `src/features/board/api.ts`).
- **Módulos y límites:** `auth` mantiene sesión/perfil; `boards` compone selector, creación y miembros; `board` contiene Kanban, tareas, adjuntos, comentarios y `AssigneePicker`; `src/types/` define modelos. La autorización real reside en Postgres/Storage, no en la visibilidad de controles React.
- **Datos y permisos:** cada tarea referencia obligatoriamente a un tablero. Admin activo ve todos; usuario/invitado activo accede solo por membresía. Ser responsable no da acceso. RLS restrictiva sigue el tablero para tareas, asignaciones, comentarios y adjuntos. Alta admin/usuario requiere pertenencia; traslado exige acceso a origen y destino. Las cuentas activas existentes se asignan inicialmente a Offline; General inicia sin miembros (`supabase/migrations/202610210001_boards.sql:4-22,24-59,63-131`).
- **Regla de dependencias observada:** las páginas de feature pueden usar sus hooks/API locales, tipos compartidos y el cliente en `src/lib/`; la inicialización y el routing viven en `App.tsx` (`src/App.tsx:1-40`, `src/features/board/api.ts:1-21`). No asumir una separación por capas que el código actual no implementa.
- **Fuentes de verdad:** `specs/` contiene la intención funcional y las decisiones de producto (`AGENTS.md:33-40`); `supabase-schema.sql` es el schema SQL de referencia según `AGENTS.md:68-70`; el código actual describe el comportamiento implementado. Las carpetas `.data/` y `.design/` documentan sus respectivos dominios sin reemplazar esas fuentes.

## 1. Contexto y alcance

El tablero añade administración de cuentas y asignación múltiple de responsables. La SPA sigue alojada en GitHub Pages; las operaciones dinámicas se ejecutan en servicios gestionados de Supabase. La frase histórica «sin servidor propio» significa que no hay infraestructura de servidor independiente: **no implica ausencia de código backend** (`src/features/users/UsersPage.tsx`, `supabase/functions/admin-users/index.ts`, `supabase/migrations/202610200001_task_assignments.sql`).

```mermaid
flowchart LR
  user([Usuario]) -->|HTTPS| pages[GitHub Pages<br/>assets estáticos]
  pages --> browser[SPA React en el navegador]
  browser <-->|Auth, PostgREST y Storage| supabase[(Supabase<br/>Auth + PostgreSQL + Storage)]
  browser -->|JWT verificado + acciones administrativas| edge[Supabase Edge Function<br/>admin-users]
  edge -->|API administrativa y perfiles| supabase
  browser -->|RPC autenticado| rpc[Funciones Postgres<br/>tableros, creación, asignaciones y traslados]
  rpc -->|transacción y permisos explícitos| supabase
  actions[GitHub Actions] -->|npm ci · npm run build · publica dist| pages
```

## 2. Restricciones y decisiones estructurales

- `HashRouter` y base `/dashboardFurthurr/` se conservan. `/boards` requiere sesión/perfil activo; `/board/:boardId` requiere además acceso devuelto por RLS. `/board` redirige al selector; `/users` exige admin. `/register` redirige a `/users` (`src/App.tsx:24-42`, `src/features/boards/BoardRoute.tsx`).
- Cambio concurrente observado: `src/App.tsx` añade `/profile` protegido y la cabecera del tablero usa `AccountMenu`, que ofrece «Usuarios» a admin y «Perfil»/cierre de sesión. El detalle de edición de perfil no forma parte de esta sincronización focalizada (`src/shared/ui/AccountMenu.tsx:20-35`).
- GitHub Pages no es un servidor de aplicación ni se documenta un rewrite de rutas; las instrucciones de proyecto especifican que Pages no reescribe las rutas SPA (`AGENTS.md:42-44`). El routing hash evita depender de ese rewrite (`src/App.tsx:1-2`).
- El build necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (`src/lib/supabase.ts:3-10`); `.github/workflows/deploy.yml` los toma de secretos del workflow (`.github/workflows/deploy.yml:33-42`). Nunca documentar valores ni añadir credenciales al cliente.
- La autorización debe permanecer respaldada por RLS en Supabase (`supabase-schema.sql:164-168`, `supabase-schema.sql:198-234`); ocultar una acción o proteger una ruta en React no sustituye políticas de base de datos.
- La ampliación de la edición a todas las cuentas activas está contenida en dos capas: la policy `Active accounts can update tasks` abre el `UPDATE` de `tasks` a todo autenticado activo, y el permiso por columna impide escribir `created_by`. Sin esa segunda capa, un usuario podría reclamar la propiedad de una tarea ajena y después borrarla.
- El flujo de despliegue comprobado en `.github/workflows/deploy.yml` usa Node 20, `npm ci`, `npm run build`, carga `dist` y despliega a GitHub Pages desde `main` o mediante ejecución manual (`.github/workflows/deploy.yml:1-53`).

## 3. Bloques de construcción

| Bloque | Responsabilidad | Evidencia |
| --- | --- | --- |
| Entrada y composición | Monta React, providers, `HashRouter` y rutas | `src/main.tsx:6-10`, `src/App.tsx:1-40` |
| Auth | Sesión, perfil activo, limpieza de caché y refresco a los 30 s/al recuperar foco | `src/features/auth/AuthContext.tsx:27-98`, `src/features/auth/ProtectedRoute.tsx:9-34` |
| Users | Listado paginado, alta confirmada, nombre, contraseña y estado; sin edición de roles en UI | `src/features/users/UsersPage.tsx`, `src/features/users/api.ts` |
| Boards | Selector de tableros accesibles; creación admin; gestión de miembros; ruta valida el acceso | `src/features/boards/BoardsPage.tsx`, `src/features/boards/BoardRoute.tsx`, `src/features/boards/api.ts` |
| Board | Columnas, tarjetas, modales, ordenamiento y mutaciones de tareas | `src/features/board/BoardPage.tsx:30-53`, `src/features/board/api.ts:5-29`, `src/features/board/BoardPage.tsx:97-147` |
| Comentarios y adjuntos | Hooks/API asociados a tareas y Storage para ficheros | `src/features/board/commentsApi.ts:5-24`, `src/features/board/attachmentsApi.ts:5-22`, `src/features/board/attachmentsApi.ts:24-72` |
| Cliente Supabase | Crea el cliente con las variables de entorno públicas requeridas | `src/lib/supabase.ts:1-10` |
| Tipos compartidos | Roles, estados, prioridades y modelos de perfil/tablero/tarea/comentario/adjunto | `src/types/index.ts` |
| Servicio gestionado | Auth, persistencia, Storage y políticas RLS | `supabase-schema.sql:10-168`, `supabase-schema.sql:349-424` |
| Administración privilegiada | Verifica JWT con `auth.getUser`, exige admin activo y ejecuta API administrativa | `supabase/functions/admin-users/index.ts:20-72`, `supabase/functions/admin-users/validation.ts` |
| Funciones transaccionales | Alta de tarea con responsables y sustitución completa de asignaciones | `supabase/migrations/202610200001_task_assignments.sql:7-76` |
| Políticas de edición compartida | Permisos por columna en `tasks` y policy de `UPDATE` para todo autenticado activo | `supabase/migrations/202610200002_shared_task_editing.sql:1-22` |
| Políticas de tableros | Membresías, aislamiento RLS de datos/Storage y RPCs para creación, traslado y gestión de miembros | `supabase/migrations/202610210001_boards.sql` |

TanStack Query está configurado en `src/App.tsx` con `staleTime` de cinco minutos y un reintento (`src/App.tsx:10-17`); las queries de tareas, comentarios y adjuntos se definen junto a la feature correspondiente (`src/features/board/api.ts:24-29`, `src/features/board/commentsApi.ts:19-24`, `src/features/board/attachmentsApi.ts:16-22`). El tablero permite mover tareas con dnd-kit y dispone de sensor de teclado (`src/features/board/BoardPage.tsx:56-65`, `src/features/board/BoardPage.tsx:97-147`).

## 4. Flujos principales

### Inicio y acceso

1. `AuthProvider` recupera la sesión de Supabase y escucha cambios de autenticación (`src/features/auth/AuthContext.tsx:38-63`).
2. Con una sesión, obtiene el perfil desde `profiles`; sin sesión, limpia el estado (`src/features/auth/AuthContext.tsx:22-36`, `src/features/auth/AuthContext.tsx:43-48`).
3. `ProtectedRoute` redirige sin sesión, bloquea perfiles ausentes/inactivos y comprueba `adminOnly`. El perfil se refresca cada 30 segundos y al recuperar foco; se descartan respuestas de sesiones anteriores y se limpia la caché al cambiar identidad o perder acceso (`src/features/auth/ProtectedRoute.tsx:21-32`, `src/features/auth/AuthContext.tsx:27-98`).
4. Tras autenticarse, el usuario consulta `boards`; RLS devuelve todos a admin y solo membresías a otras cuentas. `BoardRoute` vuelve a comprobar acceso antes de montar el Kanban.
5. `BoardPage` consulta tareas por `board_id`; comentarios y adjuntos siguen sujetos a RLS del tablero (`src/features/board/api.ts`, `src/features/board/commentsApi.ts`, `src/features/board/attachmentsApi.ts`).

### Datos del tablero

La creación usa `create_task_with_assignees(p_board_id, ...)`: deriva propietario de `auth.uid()`, requiere acceso al tablero y rol admin/usuario activos, guarda tarea + responsables atómicamente y calcula posición por tablero/estado. `move_task_to_board` requiere acceso a origen y destino, cambia el `board_id` del mismo registro y conserva relaciones. Admin sustituye miembros mediante `set_board_members`; asignar una tarea no da pertenencia. Policies restrictivas por tablero también limitan comentarios, asignaciones y adjuntos. El traslado limpia cachés relacionadas. La edición y borrado conservan reglas previas (`supabase/migrations/202610210001_boards.sql`, `src/features/boards/api.ts`).

### Administración de cuentas

`UsersPage` llama a `admin-users`. La función verifica el token y el perfil admin activo antes de procesar cualquier acción. El alta usa `email_confirm: true` y fuerza rol `usuario`/estado activo; un fallo del perfil intenta compensarse eliminando el alta incompleta. `rename` solo cambia `profiles.full_name`; contraseñas se gestionan en Auth. Desactivar modifica `is_active`, no borra contenido ni invalida criptográficamente los JWT. RLS bloquea solicitudes nuevas con tokens antiguos; no retira archivos ya descargados ni URLs firmadas ya emitidas (`supabase/functions/admin-users/index.ts:24-72`, `supabase/migrations/202610190001_user_administration.sql`).

## 5. Despliegue y operación

El workflow `.github/workflows/deploy.yml` compila la SPA en GitHub Actions y publica `dist` en Pages (`.github/workflows/deploy.yml:17-53`). Para trabajo local, `npm run dev` inicia Vite, `npm run build` ejecuta TypeScript y Vite, `npm run lint` ejecuta ESLint y `npm run preview` sirve el build local (`package.json:6-10`). La configuración de Pages y el prefijo de URL están acoplados al `base` de Vite y al `HashRouter` (`vite.config.ts:6-13`, `src/App.tsx:1-37`).

Ese workflow **no despliega SQL ni Edge Functions**. En instalaciones existentes se aplican migraciones en orden y se mantiene configuración de Auth según [la guía operativa](../supabase/README.md). No reejecutar el bootstrap sobre una BD existente. La secuencia de tableros ya se aplicó al proyecto elegido; el push a Pages está pendiente.

El selector y las nuevas operaciones requieren `202610210001_boards.sql` además de las migraciones anteriores. Esa secuencia ya se aplicó al proyecto elegido; el frontend compatible aún no se desplegó a Pages.

## 6. Riesgos y límites conocidos

- La disponibilidad depende de GitHub Pages y Supabase, incluidas Edge Functions y RPCs. No se observó persistencia local alternativa.
- Las credenciales de compilación son requisito del despliegue (`.github/workflows/deploy.yml:33-37`). Se documentan solo los nombres de variables; los valores se mantienen en el entorno/secretos.
- El schema SQL agrupa políticas RLS y políticas de Storage (`supabase-schema.sql:161-168`, `supabase-schema.sql:359-402`). Cualquier cambio de autorización debe contrastarse con `specs/05-auth-roles-permisos.md` y validarse en Supabase; la UI por sí sola no es evidencia de permiso efectivo.
- No hay evidencia en las rutas de acceso consultadas de uso activo de Supabase Realtime; no asumir sincronización en tiempo real (`src/App.tsx:1-55`, `src/features/board/api.ts:1-165`, `package.json:12-23`).
- Las sustituciones concurrentes de responsables se serializan; prevalece el último conjunto guardado, sin resolución de conflictos del borrador. El código no promete revocar sesiones al cambiar contraseñas ni eliminar enlaces firmados al desactivar cuentas.
- Ampliar la edición de tareas a toda cuenta activa aumenta la superficie de escritura concurrente sobre `tasks`: varias personas pueden editar la misma card sin bloqueo de versión ni detección de conflicto de borrador, y la última escritura prevalece. La ausencia de ese mecanismo es una limitación conocida del modelo, no un defecto introducido por la migración.
- La regla de edición compartida está contenida en la base de datos, no en la interfaz. Un cliente que omita la capa React queda igualmente sujeto a RLS y a los permisos por columna.
- `task-attachments` es privado y los enlaces firmados expiran; enlaces ya emitidos o datos descargados no se revocan retroactivamente mediante RLS.

## Evidencia de implementación y límites de esta revisión

En revisiones previas al cambio de tableros se registraron 79 pruebas Vitest, 9 pruebas Deno de `admin-users`, build/lint correctos y aviso de bundle superior a 500 kB. Las pruebas SQL de las migraciones entonces existentes se ejecutaron con `ROLLBACK`, y Chromium verificó alta/detalle/asignaciones con respuestas simuladas. Esa evidencia previa no prueba el flujo de tableros ni la aplicación de su migración.

Para tableros se registraron 111 pruebas Vitest, lint/build correctos y advertencia de chunk principal >500 kB. Los probes SQL pasaron en PostgreSQL local embebido con Auth/Storage simulados y en el proyecto Supabase elegido; los fixtures terminan en `ROLLBACK`. Chromium con backend simulado verificó selector, miembros y traslado a 360/768/1440 px. La SPA aún no se desplegó; no es auditoría de seguridad completa ni accesibilidad WCAG.

## Decisiones

- [ADR 0001: SPA estática con Supabase](decisions/0001-spa-estatica-supabase.md)
- [ADR 0002: HashRouter para GitHub Pages](decisions/0002-hashrouter-github-pages.md)
- [ADR 0003: Membresía explícita para acceso a tableros](decisions/0003-membresia-explicita-tableros.md)

## Índice de documentación relacionada

- [Datos y persistencia](../.data/README.md)
- [Sistema visual](../.design/README.md)
- [Mapa de proyecto](../.navigator/ai-context.md)
- [Especificaciones funcionales](../specs/README.md)
