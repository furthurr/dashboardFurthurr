# Datos & API — Dashboard Furthurr

Documentación canónica de datos y contratos consumidos por la aplicación. Léela antes de cambiar consultas, tipos, el schema de Supabase o los límites de autorización.

## Estado de sincronización

- Tecnología detectada: cliente TypeScript `@supabase/supabase-js`, Auth/PostgREST/PostgreSQL/Storage, Edge Function `admin-users` y RPCs de tareas/asignaciones/tableros.
- Modo: `full`.
- ¿BD interna?: No. La persistencia es PostgreSQL gestionado externamente por Supabase; el schema de referencia está en `supabase-schema.sql`.
- Commit base revisado (referencia histórica): `81335b92bc1962a47c9c3bb963271c3667bc7b63` (2026-05-04).
- Baseline vigente: release `v0.6.0`, commit `21a44df45258f8b7ebc030ec95a4c5189d69dade` (2026-10-22, `chore(release): preparar versión v0.6.0`), con tag anotado `v0.6.0` apuntando a ese commit. La rama `main` está sincronizada con `origin/main` en `93c1db2` (`docs(canonica): actualizar baseline tras la publicación de v0.6.0`), que ya incluye la edición de `specs/05-auth-roles-permisos.md`; el árbol de trabajo solo contiene la actualización documental de este ciclo (cierre de los pendientes de despliegue de `admin-users` y de la configuración de Auth), pendiente de commit, y no hay diferencias de producto ni migraciones sin trackear. **Esta documentación declara `93c1db2` como fuente sincronizada; el baseline de release sigue siendo `v0.6.0` (`21a44df`).**
- Última actualización documental: 2026-10-22, **cierre de los dos pendientes de despliegue** (redeploy verificado de la Edge Function `admin-users` en versión 4 con código idéntico al repo, y configuración de Auth remota sin cambios aplicables), ciclo de vida de tableros (`is_active`, renombrado, activación/desactivación y conteo de pendientes), **aplicación verificada de `202610220001` y `202610220002` en el proyecto Supabase remoto** y **publicación de la SPA con `v0.6.0` en GitHub Pages**; el baseline ya está versionado en `21a44df`.
- Commit base de implementación y primera sincronización: `eb25418de42c045d6be32a3091f8bb3f36b24ba0`, incluye el código, la migración y la documentación funcional inicial.
- Registro de despliegue: la secuencia de migraciones y las pruebas SQL `boards.sql`, `task_assignments.sql` y `user_access.sql` se ejecutaron correctamente en el proyecto Supabase seleccionado el 2026-10-21, y el 2026-10-22 se aplicaron además `202610220001` y `202610220002` con las tres suites remotas en `PASS`. Ese registro está versionado en `21a44df`; el baseline de esta actualización **no queda pendiente**.
- Estado de despliegue del ciclo de vida: `202610220001` y `202610220002` **aplicadas el 2026-10-22 en el proyecto Supabase remoto**, en ese orden. Las tres suites SQL remotas (`boards.sql`, `task_assignments.sql`, `user_access.sql`) pasan y revierten sus fixtures con `ROLLBACK`. La SPA se **publicó en GitHub Pages con `v0.6.0` el 2026-10-22** (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`, conclusión `success`) y está servida en <https://furthurr.github.io/dashboardFurthurr/>. El redeploy de la Edge Function `admin-users` y la configuración de Auth remota se verificaron ese mismo 2026-10-22 y **ya no están pendientes** (marca siguiente).
- **Estado de la Edge Function `admin-users` y de la configuración de Auth (verificado el 2026-10-22):** el código desplegado en el proyecto Supabase remoto era la **versión 3** y **no contenía** la acción `promote-admin`, de modo que el botón «Hacer administrador» de «Usuarios» habría fallado en producción. Se redesplegó con `supabase functions deploy admin-users`: quedó en **versión 4, ACTIVE**, y el código descargado del remoto (`supabase functions download admin-users`) es **idéntico byte a byte** a `supabase/functions/admin-users/index.ts` y `supabase/functions/admin-users/validation.ts` del repo. Sin sesión, la función responde **401** con `{"error":"Inicia sesión para continuar."}`: el bearer se valida en el propio código de la función (`supabase/functions/admin-users/index.ts:18`), no en el gateway. `supabase config diff` informa **0 cambios que aplicar** (`update: 0`): `auth.enable_signup` no aparece en la diferencia —el registro público ya está deshabilitado en remoto, igual que en `supabase/config.toml`— y `functions list` confirma `verify_jwt: false` para `admin-users`, tal como declara el repo. Las 10 diferencias que reporta el diff son propiedades «solo remotas» (site_url, correo, MFA, pooler, storage vector) que `config push` conservaría y que no requieren ninguna acción. Consecuencia: el contrato desplegado (base de datos + Edge Function + SPA publicada en `v0.6.0`) está **alineado**.

## Contexto para IA

- **Qué consume:** SDK para Auth/tablas/Storage, `functions.invoke('admin-users')` para administración (incluida la promoción a admin) y RPCs para listar/crear/trasladar tareas, reemplazar responsables, gestionar miembros y operar el ciclo de vida de tableros. No se encontró OpenAPI; [el catálogo](01-endpoints.md) documenta los contratos observados.
- **Auth:** `AuthProvider` verifica el perfil activo, lo refresca cada 30 s/al recuperar foco y limpia la caché ante cambio de identidad o pérdida de acceso. RLS/grants y verificaciones explícitas en Edge/RPC autorizan las operaciones; `is_active` no es revocación criptográfica de JWT (`src/features/auth/AuthContext.tsx:27-98`).
- **Modelos clave:** `Board` (con `is_active` y `pending_count`), `Task.board_id`, `board_members`, `AssigneeProfile`, `TaskWithAssignees.assignees` y `ManagedUser` (`src/types/index.ts`, `supabase/migrations/202610210001_boards.sql`).
- **Fuentes de datos:** Supabase Auth, PostgreSQL administrado, Storage y caché de TanStack Query. No se encontró una base de datos local.
- **Convenciones:** TanStack Query, cinco minutos/un reintento por defecto; administración y usuarios asignables usan `staleTime: 0`. El catálogo de tableros se obtiene por RPC (`list_boards_with_pending_counts`) con `staleTime: 0` y refresco de 30 s; alta, renombrado y activación/desactivación invalidan `['boards']`. Listado administrativo de 50 por página y consulta de cuentas activas en lotes de 500. No hay timeout explícito ni contrato global de error; la Edge Function sí devuelve `{ error: string }` y el selector de tableros traduce códigos SQL a mensajes (`src/features/boards/BoardsPage.tsx:72-91`).
- **Integridad y permisos:** cada tarea tiene un `board_id`; admins ven todos los tableros y otras cuentas activas solo los **activos** en los que son miembros. Ser responsable de una tarea no concede acceso al tablero. RLS limita tareas, asignaciones, comentarios y metadatos/objetos de Storage. Las acciones sobre tareas existentes requieren acceso a su tablero; crear tarea además requiere rol y membresía. El traslado requiere acceso al origen y a un destino activo. Admin gestiona miembros, renombra y activa/desactiva tableros.
- **Ciclo de vida de tableros:** `boards.is_active` permite desactivar un tablero sin borrar tareas, comentarios, adjuntos ni membresías. Mientras está desactivado, sus miembros dejan de verlo y de acceder a sus tareas (también por URL directa); el admin activo conserva el acceso y puede reactivarlo. El listado de pendientes suma `backlog`, `por_hacer` y `haciendo`.
- **Campos sensibles/PII:** perfiles incluyen email, nombre y avatar; tareas, comentarios y adjuntos contienen contenido aportado por usuarios e identificadores. No se documentan valores reales.
- **Límite de esta documentación:** registra el contrato observado y las comprobaciones remotas fechadas, pero no certifica la configuración desplegada de Supabase más allá de esas verificaciones ni sustituye una auditoría de seguridad.

## Índice

- [Catálogo de operaciones](01-endpoints.md)
- [Modelos y tipos](02-models.md)
- [Mapeo entre Supabase y la aplicación](03-mapping.md)
- [Schema relacional y Storage](04-schema.md)
- [Convenciones de acceso y errores](05-conventions.md)
- [Datos sensibles y PII](06-sensitive-data.md)
- [Variables y entornos](07-environments.md)
- [Deuda técnica de datos/APIs](data-tech-debt.md)

## Fuentes de verdad

- `supabase-schema.sql`: bootstrap de referencia (incluye ya `boards.is_active` y las tres RPCs de ciclo de vida); `supabase/migrations/`: cambios incrementales para instalaciones existentes, con `202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql` ya aplicadas el 2026-10-22 en el proyecto remoto. `supabase/README.md`: orden y operación; no reejecutar el bootstrap sobre una BD existente.
- `src/types/index.ts`: tipos TypeScript usados por la app.
- `src/lib/supabase.ts`: inicialización y nombres de variables necesarias.
- `src/features/auth/`, `src/features/users/`, `src/features/boards/` y `src/features/board/`: operaciones cliente; `supabase/functions/admin-users/`: validación y acciones servidor.
- `specs/04-modelo-datos.md` y `specs/05-auth-roles-permisos.md`: intención de producto y matriz prevista; contrastar con el SQL al cambiar el contrato.

## Discrepancias que deben conservarse visibles

- `task_attachments.file_url` conserva una URL generada por `getPublicUrl`, aunque el bucket es privado; la aplicación extrae el path y obtiene URLs firmadas breves para visualización. La discrepancia semántica remanente se registra en [deuda técnica](data-tech-debt.md).
- Las claves foráneas de autor/cargador de comentarios y adjuntos combinan `ON DELETE SET NULL` con columnas `NOT NULL`; ver [deuda técnica](data-tech-debt.md).
- Los responsables ahora usan una proyección explícita `AssigneeProfile`; la relación de autor de comentarios sigue tipada como `Profile` completo. D-03 queda parcialmente resuelta; ver [mapeo](03-mapping.md) y [deuda técnica](data-tech-debt.md).

Estas observaciones registran deuda restante, no certifican el entorno desplegado.

## Evidencia y límites

Se reutiliza evidencia previa de implementación en esta sesión: 79 pruebas Vitest, 9 Deno, build/lint correctos, pruebas SQL con `ROLLBACK` y comprobación HTTP de denegación anónima de RPC. Las migraciones y la Edge Function se registraron como desplegadas antes de esta sincronización.

Para tableros se registraron 111 pruebas Vitest, lint y build correctos. Los tres probes SQL pasaron con Auth/Storage simulados contra bootstrap+migración incremental local y contra el proyecto Supabase seleccionado; sus fixtures se revierten. Chromium con backend simulado cubrió selector, miembros y traslado a 360/768/1440 px. Esto no es E2E completo ni auditoría de seguridad. El build informa que el chunk principal supera 500 kB.

La acción local `promote-admin` se verificó con 115 pruebas Vitest, 11 pruebas Deno de `admin-users`, lint y build correctos. No requiere migración SQL. Su despliegue se comprobó el 2026-10-22: el código remoto pasó de la versión 3 (sin `promote-admin`) a la **versión 4, ACTIVE**, con el código **idéntico byte a byte** al del repo. Lo que **no** se ha ejecutado es la verificación funcional de `promote-admin` en producción con una sesión real de administrador: la comprobación fue de equivalencia de código desplegado y de rechazo sin sesión. El baseline Git vigente es `v0.6.0` / `21a44df`.

### Ciclo de vida de tableros (2026-10-22)

Evidencia de la implementación en la release `v0.6.0` (commit `21a44df`), **no comandos repetidos durante esta sincronización documental**:

- Vitest: 128 pruebas en 15 archivos, todas correctas. Cubren el selector (secciones, badge, renombrado, activar/desactivar, vista sin acciones para no admin) en `src/features/boards/BoardsPage.test.tsx:117-200`, los contratos RPC en `src/features/boards/api.test.ts:23-58` y el filtrado de destinos en `src/features/board/TaskDetailModal.test.tsx:15`.
- `npm run lint` y `npm run build` correctos; persiste el aviso preexistente de chunk principal >500 kB.
- SQL ejecutado contra PostgreSQL 16 local en Docker con Auth/Storage simulados, en dos rutas: (a) bootstrap nuevo y (b) base existente + `202610220001` y `202610220002`. Los probes de `supabase/tests/boards.sql` pasan en ambas; el baseline con el bootstrap de `HEAD` también pasó.
- Comprobación adicional: con tareas en los cinco estados, el contador marca 3 (solo `backlog`, `por_hacer` y `haciendo`).
- Navegador real (Chrome headless con CDP) contra `npm run dev`, interceptando las llamadas a Supabase con datos simulados: se verificaron las dos secciones, el badge, el renombrado (diálogo precargado y actualización de la lista), el ciclo desactivar/reactivar y la vista de rol no administrador sin acciones ni sección de desactivados.

Límites de esta evidencia:

- La verificación SQL descrita arriba es local, con PostgreSQL 16 en Docker y Auth/Storage simulados; la aplicación y la verificación remotas se documentan en el apartado siguiente.
- No hay E2E con cuentas reales ni auditoría de accesibilidad.
- La verificación SQL local usa un harness propio con Auth/Storage simulados, no el entorno Supabase: no certifica el comportamiento del servicio Supabase, sus grants efectivos ni sus políticas Storage.
- El baseline Git es `v0.6.0` / `21a44df` y ya no está pendiente: el commit incluye esta feature, las dos migraciones y esta documentación.

### Aplicación remota y verificación (2026-10-22)

Hecho verificado sobre el proyecto Supabase remoto (proyecto «furthurr'sDashboard»), registrado en `supabase/README.md`:

- Se aplicaron en este orden `supabase/migrations/202610220001_board_access_returning.sql` y `supabase/migrations/202610220002_board_lifecycle.sql`.
- Estado previo comprobado antes de aplicar: `boards.is_active` no existía y tampoco existían las RPCs `rename_board`, `set_board_active` y `list_boards_with_pending_counts`, ni la policy «Members read own memberships».
- Estado posterior comprobado: `boards.is_active` presente, las tres RPCs presentes y la policy «Members read own memberships» presente. El proyecto conserva sus 4 tableros y sus 32 tareas; la columna se creó con `true` en todos ellos.
- Verificación posterior a la aplicación: las tres suites SQL remotas pasan y revierten sus fixtures con `ROLLBACK`:
  - `supabase/tests/boards.sql` → «PASS: boards, membership, RPC authorization, resources, transfer and revocation», con los nuevos probes de ciclo de vida (el admin ve los tableros desactivados y su contador, renombra, rechaza duplicado y nombre vacío, desactiva y reactiva; el miembro pierde visibilidad y acceso y recibe `42501`).
  - `supabase/tests/task_assignments.sql` → PASS.
  - `supabase/tests/user_access.sql` → PASS.

Estado y límites que quedan tras la aplicación remota:

- La SPA compatible **ya se publicó en GitHub Pages** con `v0.6.0` el 2026-10-22 (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`, conclusión `success`) y está servida en <https://furthurr.github.io/dashboardFurthurr/>.
- El **baseline Git ya no está pendiente**: es `v0.6.0` / `21a44df`, con `main` sincronizada con `origin/main`.
- La publicación no aporta evidencia funcional nueva: la verificación remota sigue cubriendo solo SQL y **no sustituye una comprobación de la UI contra el servicio real, ni una auditoría de seguridad, ni E2E con cuentas reales**.
- El **redeploy de la Edge Function `admin-users`** (acción `promote-admin` de `v0.5.0`) y la **configuración de Auth remota** (`supabase/config.toml`) **ya no están pendientes**: ambos se verificaron el 2026-10-22 en el proyecto Supabase remoto (versión 4 de la función con código idéntico al repo; `config diff` con `update: 0` y `auth.enable_signup` ya deshabilitado en remoto).
- Siguen vigentes dos límites: **no hay E2E con cuentas reales ni auditoría de accesibilidad**, y la **verificación funcional de `promote-admin` en producción no se ha ejecutado con una sesión real de administrador** (la comprobación fue de equivalencia de código desplegado y de rechazo sin sesión: 401 con el mensaje propio de la función).

### Edge Function `admin-users` y configuración de Auth (2026-10-22)

Verificación registrada en `supabase/README.md`:

- Estado previo comprobado: el código desplegado en el proyecto Supabase remoto era la **versión 3** y **no contenía** la acción `promote-admin`; el botón «Hacer administrador» de «Usuarios» habría fallado en producción.
- Redeploy: `supabase functions deploy admin-users` deja la función en **versión 4, ACTIVE**.
- Equivalencia de código: `supabase functions download admin-users` devuelve un código **idéntico byte a byte** a `supabase/functions/admin-users/index.ts` y `supabase/functions/admin-users/validation.ts` del repo.
- Validación de sesión: sin sesión, la función responde **401** con `{"error":"Inicia sesión para continuar."}` (`supabase/functions/admin-users/index.ts:18`), es decir, la comprobación del bearer la hace el propio código de la función y no el gateway (que está desactivado con `verify_jwt = false`).
- Configuración remota: `supabase config diff` informa **0 cambios que aplicar** (`update: 0`); `auth.enable_signup` no aparece en la diferencia —el registro público ya está deshabilitado en remoto, igual que en `supabase/config.toml`— y `functions list` confirma `verify_jwt: false` para `admin-users`. Las 10 diferencias reportadas son propiedades «solo remotas» (site_url, correo, MFA, pooler, storage vector) que `config push` conservaría y que no requieren ninguna acción.

Límites de esta verificación: acredita la equivalencia del código desplegado y el rechazo sin sesión, **no** la promoción de rol con una sesión real de administrador. Sigue sin ejecutarse esa comprobación funcional en producción; tampoco hay E2E con cuentas reales ni auditoría de accesibilidad.
